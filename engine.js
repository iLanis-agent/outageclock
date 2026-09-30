/* OutageClock engine - power-outage food-safety logic.
   Pure functions, no DOM. Exported for Node tests and attached to window for the app.
   Thresholds from USDA FSIS / FoodSafety.gov / CDC:
   - Refrigerator keeps food safe up to 4 hours if the door stays closed.
   - A full freezer holds temperature ~48 hours; a half-full freezer ~24 hours.
   - Discard perishables held above 40 F (4 C) for 2+ hours (1+ hour if ambient > 90 F / 32 C).
   - Frozen food may be refrozen if it still has ice crystals or is at 40 F / 4 C or below.
   These are guidance thresholds for common cases, not a guarantee: "when in doubt, throw it out." */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) { module.exports = factory(); }
  else { root.OutageClock = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  var FRIDGE_LIMIT_H = 4;
  var FREEZER_FULL_H = 48;
  var FREEZER_HALF_H = 24;
  var HOUR_MS = 3600000;

  function freezerLimitH(kind) {
    if (kind === 'full') return FREEZER_FULL_H;
    if (kind === 'half') return FREEZER_HALF_H;
    throw new Error('Freezer kind must be "full" or "half".');
  }

  function isNum(x) { return typeof x === 'number' && isFinite(x); }

  /* Appliance status at a given moment.
     outageStartMs: epoch ms when power went out. nowMs: epoch ms now.
     Returns {elapsedH, remainingMs, deadlineMs, state} where state is
     'safe' (still inside the window) or 'expired' (window passed). */
  function applianceStatus(limitH, outageStartMs, nowMs) {
    if (!isNum(limitH) || limitH <= 0) throw new Error('Limit must be positive hours.');
    if (!isNum(outageStartMs) || !isNum(nowMs)) throw new Error('Times must be epoch ms.');
    if (nowMs < outageStartMs) throw new Error('Now is before the outage start.');
    var elapsedMs = nowMs - outageStartMs;
    var deadlineMs = outageStartMs + limitH * HOUR_MS;
    var remainingMs = deadlineMs - nowMs;
    return {
      limitH: limitH,
      elapsedMs: elapsedMs,
      elapsedH: elapsedMs / HOUR_MS,
      remainingMs: Math.max(0, remainingMs),
      deadlineMs: deadlineMs,
      state: remainingMs > 0 ? 'safe' : 'expired'
    };
  }

  function fmtDuration(ms) {
    var neg = ms < 0;
    ms = Math.abs(ms);
    var totalMin = Math.round(ms / 60000);
    var d = Math.floor(totalMin / 1440);
    var h = Math.floor((totalMin % 1440) / 60);
    var m = totalMin % 60;
    var s = '';
    if (d > 0) s += d + 'd ';
    s += h + 'h ' + (m < 10 ? '0' : '') + m + 'm';
    return neg ? '-' + s : s;
  }

  /* The 2-hour / 1-hour exposure rule for food held above 40 F (4 C). */
  function exposureLimitH(ambientC) {
    if (!isNum(ambientC)) throw new Error('Ambient temperature required.');
    return ambientC >= 32 ? 1 : 2;
  }

  /* Refreeze verdict for frozen food after power returns.
     o: {hasIceCrystals: bool|null, tempC: number|null, hoursAbove4C: number|null}
     USDA: may refreeze if it still contains ice crystals OR is 40 F / 4 C or below;
     discard if thawed and held above 40 F for 2+ hours. */
  function refreezeVerdict(o) {
    if (o.hasIceCrystals === true) {
      return { verdict: 'refreeze', reason: 'Still contains ice crystals - safe to refreeze or cook (quality may suffer).' };
    }
    if (isNum(o.tempC) && o.tempC <= 4) {
      return { verdict: 'refreeze', reason: 'At or below 4 C (40 F) - safe to refreeze or cook (quality may suffer).' };
    }
    if (isNum(o.hoursAbove4C) && o.hoursAbove4C >= 2) {
      return { verdict: 'discard', reason: 'Thawed above 4 C (40 F) for 2 hours or more - discard.' };
    }
    return { verdict: 'check', reason: 'Cannot tell from what you entered - check each package with a thermometer; never taste to decide. When in doubt, throw it out.' };
  }

  /* Keep/toss chart (FoodSafety.gov "Food Safety During Power Outage" / USDA FSIS):
     verdict for a perishable held above 40 F (4 C) for over 2 hours.
     kind: 'keep' or 'discard'; note carries exceptions. */
  var FOOD_CHART = [
    { cat: 'Meat, poultry, seafood', item: 'Raw or cooked meat, poultry, fish, seafood', kind: 'discard' },
    { cat: 'Meat, poultry, seafood', item: 'Thawing meat or poultry', kind: 'discard' },
    { cat: 'Meat, poultry, seafood', item: 'Meat, tuna, shrimp, chicken or egg salad', kind: 'discard' },
    { cat: 'Meat, poultry, seafood', item: 'Gravy, stuffing, broth', kind: 'discard' },
    { cat: 'Meat, poultry, seafood', item: 'Lunchmeats, hot dogs, bacon, sausage', kind: 'discard' },
    { cat: 'Meat, poultry, seafood', item: 'Pizza with any topping', kind: 'discard' },
    { cat: 'Meat, poultry, seafood', item: 'Opened canned meats or fish', kind: 'discard' },
    { cat: 'Cheese', item: 'Soft cheeses (Brie, Camembert, cottage, cream, ricotta, mozzarella, queso fresco)', kind: 'discard' },
    { cat: 'Cheese', item: 'Shredded or low-fat cheeses', kind: 'discard' },
    { cat: 'Cheese', item: 'Hard cheeses (Cheddar, Colby, Swiss, Parmesan, provolone, Romano)', kind: 'keep' },
    { cat: 'Cheese', item: 'Processed cheeses, grated Parmesan in a can or jar', kind: 'keep' },
    { cat: 'Dairy', item: 'Milk, cream, sour cream, buttermilk, yogurt, eggnog, soy milk', kind: 'discard' },
    { cat: 'Dairy', item: 'Opened baby formula', kind: 'discard' },
    { cat: 'Dairy', item: 'Butter, margarine', kind: 'keep' },
    { cat: 'Eggs', item: 'Fresh shell eggs, hard-cooked eggs, egg dishes, egg products', kind: 'discard' },
    { cat: 'Eggs', item: 'Custards, puddings, quiche', kind: 'discard' },
    { cat: 'Leftovers', item: 'Casseroles, soups, stews, leftovers', kind: 'discard' },
    { cat: 'Fruits', item: 'Fresh fruits, cut', kind: 'discard' },
    { cat: 'Fruits', item: 'Fresh fruits, whole and uncut; dried fruits, raisins, dates', kind: 'keep' },
    { cat: 'Fruits', item: 'Opened fruit juices; opened canned fruits', kind: 'keep' },
    { cat: 'Fruits', item: 'Sliced or shredded coconut', kind: 'discard' },
    { cat: 'Sauces & spreads', item: 'Opened mayonnaise, tartar sauce, horseradish', kind: 'discard', note: 'Keep unless held above 10 C (50 F) for over 8 hours.' },
    { cat: 'Sauces & spreads', item: 'Peanut butter, jelly, relish, ketchup, mustard, pickles, olives', kind: 'keep' },
    { cat: 'Sauces & spreads', item: 'Creamy salad dressings, opened; spaghetti sauce, opened', kind: 'discard' },
    { cat: 'Sauces & spreads', item: 'Commercial garlic in oil', kind: 'discard' },
    { cat: 'Bread & grains', item: 'Bread, rolls, cakes, muffins, quick breads, tortillas', kind: 'keep' },
    { cat: 'Bread & grains', item: 'Waffles, pancakes, bagels', kind: 'keep' },
    { cat: 'Bread & grains', item: 'Refrigerator biscuits, rolls, cookie dough', kind: 'discard' },
    { cat: 'Bread & grains', item: 'Cooked pasta, rice, potatoes; fresh pasta; pasta salads', kind: 'discard' },
    { cat: 'Bread & grains', item: 'Cheesecake', kind: 'discard' },
    { cat: 'Pies & pastry', item: 'Cream-filled pastries; custard, cheese-filled or chiffon pies', kind: 'discard' },
    { cat: 'Pies & pastry', item: 'Fruit pies', kind: 'keep' },
    { cat: 'Vegetables', item: 'Raw vegetables, fresh mushrooms, herbs, spices', kind: 'keep' },
    { cat: 'Vegetables', item: 'Cooked vegetables, tofu, baked potatoes, potato salad', kind: 'discard' },
    { cat: 'Vegetables', item: 'Pre-cut, pre-washed packaged greens; opened vegetable juice', kind: 'discard' }
  ];

  function lookupFood(query) {
    if (typeof query !== 'string' || !query.trim()) return [];
    var words = query.toLowerCase().trim().split(/[^a-z]+/).filter(function (w) { return w.length > 1; });
    var scored = FOOD_CHART.map(function (f) {
      var hay = (f.cat + ' ' + f.item).toLowerCase();
      var hayWords = hay.split(/[^a-z]+/);
      var score = 0;
      words.forEach(function (w) {
        if (hayWords.indexOf(w) !== -1) score += 2;        // exact word outranks
        else if (hay.indexOf(w) !== -1) score += 1;        // substring (cheddar in Cheddar? no: plural cheeses)
      });
      return { f: f, score: score };
    }).filter(function (s) { return s.score > 0; });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.map(function (s) { return s.f; });
  }

  return {
    FRIDGE_LIMIT_H: FRIDGE_LIMIT_H,
    FREEZER_FULL_H: FREEZER_FULL_H,
    FREEZER_HALF_H: FREEZER_HALF_H,
    freezerLimitH: freezerLimitH,
    applianceStatus: applianceStatus,
    fmtDuration: fmtDuration,
    exposureLimitH: exposureLimitH,
    refreezeVerdict: refreezeVerdict,
    FOOD_CHART: FOOD_CHART,
    lookupFood: lookupFood
  };
});
