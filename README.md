# OutageClock

The power-outage food-safety countdown. Tell it when the power died and it runs
the two USDA clocks - 4 hours for a closed fridge, 48 hours for a full freezer
(24 if half full) - then answers "keep it or toss it?" from the official
FoodSafety.gov chart, checks whether frozen food can be refrozen, and lists what
to do while it is still dark.

**Live app:** open `app.html` (or the GitHub Pages URL).

## The rules inside (USDA FSIS / FoodSafety.gov / CDC)

- A refrigerator keeps food safe up to **4 hours** if the door stays closed.
- A **full freezer** holds temperature ~48 hours; **half full**, ~24 hours.
- Discard perishables held above **4 C / 40 F** for **2+ hours** (1+ hour at 32 C / 90 F ambient).
- Frozen food may be **refrozen** if it still contains ice crystals or reads 4 C / 40 F or below.
- Never taste food to decide. When in doubt, throw it out.

The keep/toss chart is a compacted copy of the FoodSafety.gov "Food Safety
During Power Outage" table. Outage state persists in localStorage so the clock
survives a closed tab.

## Files

- `index.html` - landing page
- `app.html` - the app (countdowns, keep/toss lookup, refreeze check, do-now list)
- `engine.js` - pure-logic engine (also `require()`-able)
- `test-engine.js` - 45 engine tests: `node test-engine.js`

## Sources

- FoodSafety.gov, Food Safety During Power Outage (chart)
- USDA FSIS, Keep Your Food Safe During Emergencies
- CDC, Keep Food Safe After a Disaster or Emergency
