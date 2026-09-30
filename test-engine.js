/* OutageClock engine tests. Run: node test-engine.js */
var O = require('./engine.js');
var pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; } else { fail++; console.error('FAIL: ' + name); }
}
function eq(a, b, name) { ok(a === b, name + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
function throws(fn, name) {
  try { fn(); fail++; console.error('FAIL (no throw): ' + name); } catch (e) { pass++; }
}

var T0 = 1760000000000; // arbitrary outage start
var H = 3600000;

/* --- fridge: 4-hour rule --- */
var s1 = O.applianceStatus(O.FRIDGE_LIMIT_H, T0, T0 + 2 * H);
eq(s1.state, 'safe', 'fridge 2h in: safe');
eq(s1.remainingMs, 2 * H, 'fridge 2h in: 2h remain');
var s2 = O.applianceStatus(O.FRIDGE_LIMIT_H, T0, T0 + 4 * H);
eq(s2.state, 'expired', 'fridge exactly 4h: expired');
eq(s2.remainingMs, 0, 'fridge expired: 0 remain');
var s3 = O.applianceStatus(O.FRIDGE_LIMIT_H, T0, T0 + 6 * H);
eq(s3.state, 'expired', 'fridge 6h: expired');
eq(Math.round(s3.elapsedH), 6, 'fridge elapsed 6h');
eq(s3.deadlineMs, T0 + 4 * H, 'fridge deadline = start + 4h');

/* --- freezer: 48h full / 24h half --- */
eq(O.freezerLimitH('full'), 48, 'full freezer 48h');
eq(O.freezerLimitH('half'), 24, 'half freezer 24h');
var f1 = O.applianceStatus(O.freezerLimitH('full'), T0, T0 + 47 * H);
eq(f1.state, 'safe', 'full freezer 47h: safe');
var f2 = O.applianceStatus(O.freezerLimitH('half'), T0, T0 + 25 * H);
eq(f2.state, 'expired', 'half freezer 25h: expired');
throws(function () { O.freezerLimitH('packed'); }, 'reject unknown freezer kind');

/* --- duration formatting --- */
eq(O.fmtDuration(90 * 60000), '1h 30m', 'fmt 90m');
eq(O.fmtDuration(0), '0h 00m', 'fmt 0');
eq(O.fmtDuration(25 * H), '1d 1h 00m', 'fmt 25h');
eq(O.fmtDuration(-2 * H), '-2h 00m', 'fmt negative');

/* --- exposure rule: 2h, or 1h above 32 C --- */
eq(O.exposureLimitH(20), 2, '20 C ambient: 2h rule');
eq(O.exposureLimitH(31.9), 2, 'just under 32 C: 2h');
eq(O.exposureLimitH(32), 1, '32 C ambient: 1h rule');
eq(O.exposureLimitH(40), 1, '40 C ambient: 1h rule');
throws(function () { O.exposureLimitH(NaN); }, 'reject NaN ambient');

/* --- refreeze verdicts (USDA rules) --- */
eq(O.refreezeVerdict({ hasIceCrystals: true }).verdict, 'refreeze', 'ice crystals: refreeze');
eq(O.refreezeVerdict({ tempC: 4 }).verdict, 'refreeze', 'at 4 C: refreeze');
eq(O.refreezeVerdict({ tempC: 0 }).verdict, 'refreeze', 'at 0 C: refreeze');
eq(O.refreezeVerdict({ tempC: 5, hoursAbove4C: 3 }).verdict, 'discard', 'above 4 C for 3h: discard');
eq(O.refreezeVerdict({ tempC: 5, hoursAbove4C: 1 }).verdict, 'check', '5 C for only 1h: check');
eq(O.refreezeVerdict({}).verdict, 'check', 'nothing known: check');

/* --- food chart lookups (FoodSafety.gov chart) --- */
eq(O.FOOD_CHART.length >= 30, true, 'chart covers 30+ rows');
eq(O.lookupFood('milk')[0].kind, 'discard', 'milk: discard');
eq(O.lookupFood('butter')[0].kind, 'keep', 'butter: keep');
eq(O.lookupFood('cheddar')[0].kind, 'keep', 'cheddar: keep');
eq(O.lookupFood('brie')[0].kind, 'discard', 'brie: discard');
eq(O.lookupFood('eggs')[0].kind, 'discard', 'eggs: discard');
eq(O.lookupFood('bread')[0].kind, 'keep', 'bread: keep');
eq(O.lookupFood('cookie dough')[0].kind, 'discard', 'cookie dough: discard');
eq(O.lookupFood('pizza')[0].kind, 'discard', 'pizza: discard');
eq(O.lookupFood('whole apples')[0].kind, 'keep', 'whole fruit: keep');
eq(O.lookupFood('fruit pie')[0].kind, 'keep', 'fruit pie: keep');
var mayo = O.lookupFood('mayonnaise')[0];
eq(mayo.kind, 'discard', 'mayo: discard');
ok(mayo.note && mayo.note.indexOf('8 hours') !== -1, 'mayo carries 8-hour exception note');
eq(O.lookupFood('').length, 0, 'empty query returns none');
eq(O.lookupFood('zzzqqq').length, 0, 'nonsense returns none');

/* --- validation --- */
throws(function () { O.applianceStatus(4, T0, T0 - 1); }, 'reject now before start');
throws(function () { O.applianceStatus(0, T0, T0); }, 'reject zero limit');
throws(function () { O.applianceStatus(4, 'x', T0); }, 'reject non-numeric start');

console.log(pass + '/' + (pass + fail) + ' tests passed');
process.exit(fail ? 1 : 0);
