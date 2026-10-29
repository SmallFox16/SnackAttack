# Bug: `parseGPS` treats a blank coordinate as 0

**Status:** Open — documented, not fixed
**Severity:** Low (no current data triggers it)
**Found:** 2026-10-28, while writing unit tests for distance calculation (Task #13)
**Affected code:** `parseGPS()` in `distance.js` (used by map markers and distance calculation in `app.js`)

## Summary

When a machine's GPS value has a comma but one side of it is blank (for example `"36.305545,"`), `parseGPS` returns `0` for the blank side instead of rejecting the value. The machine is then treated as having a real location thousands of kilometers away instead of being treated as "no GPS data."

## Cause

```js
function parseGPS(gps) {
  const [lat, lng] = (gps || "").split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}
```

In JavaScript, `Number("")` and `Number(" ")` both return `0`, not `NaN`. `0` passes the `Number.isFinite` check, so a blank part is accepted as the coordinate `0`.

## Steps to reproduce

```bash
node -e 'const { parseGPS } = require("./distance.js"); console.log(parseGPS("36.305545,"))'
```

**Expected:** `null`
**Actual:** `[ 36.305545, 0 ]`

## Behavior by input

| GPS value in the CSV | Result | Correct? |
|---|---|---|
| `"36.305545, -82.371430"` | `[36.305545, -82.37143]` | ✅ |
| `""` (empty cell) | `null` | ✅ |
| `"36.305545"` (no comma) | `null` | ✅ |
| `"36.305545,"` (longitude missing) | `[36.305545, 0]` | ❌ |
| `", -82.371430"` (latitude missing) | `[0, -82.37143]` | ❌ |
| `" , "` | `[0, 0]` | ❌ |

A fully empty cell is handled correctly; only a value with a comma and a blank side is affected.

## Impact

- **Map:** the marker is placed far off campus (longitude 0 is near Spain/North Africa; `[0, 0]` is in the Atlantic off West Africa).
- **Distance:** the machine gets a distance of roughly **7,128 km** (`[36.3, 0]`) or **9,325 km** (`[0, 0]`) from campus instead of `null`.
- **Data quality:** bad survey data is hidden as a real location instead of being reported as missing. The upcoming "closest machine" PBI must tell the user when no machine has valid distance data, and this bug would let invalid data count as valid.
- **Closest machine:** a machine thousands of km away would never be chosen as closest, so it would not give a wrong answer there.

None of the 9 machines in the current `vending_machines.csv` trigger this bug.

## Proposed fix

Reject a value unless it has exactly two non-blank parts before converting to numbers:

```js
function parseGPS(gps) {
  const parts = (gps || "").split(",").map((part) => part.trim());
  if (parts.length !== 2 || parts.includes("")) return null;

  const [lat, lng] = parts.map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}
```

Add a unit test in `tests/distance.test.js` asserting `null` for `"36.305545,"`, `", -82.371430"`, and `" , "`.

The fix changes app behavior, so it should be done as its own task rather than in the Task #13 test/docs PR.

## Related

- [Distance calculation design — Known limitations](distance-calculation-design.md#known-limitations)
- [Testing — Known gaps](testing.md#known-gaps)
