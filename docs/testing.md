# SnackAttack Testing Standard

## Test runner

SnackAttack uses Node's built-in **`node:test`** runner with **`node:assert/strict`**. It was selected because it ships with Node, adds no dependencies, and is fast enough to run on every pull request.

Node **22 or newer** is required (CI uses Node 22).

## What gets unit tested

Unit tests cover **pure logic**: functions that take inputs and return outputs without touching the DOM, Leaflet, `fetch()`, or `navigator`.

Browser-only code (`app.js`) loads the map and reads the page as soon as it runs, so it cannot be loaded in Node. When a feature has logic worth testing, put that logic in its own file with no browser access (for example `distance.js`) and have `app.js` call it.

## Local usage

Install dependencies once:

```bash
npm install
```

Run only the unit tests:

```bash
npm test
```

Run the full quality check used in CI (ESLint, then unit tests):

```bash
npm run quality
```

## Continuous integration

`.github/workflows/quality.yml` runs `npm run quality` on every pull request and on pushes to `main`, `dev`, and `dev-*` branches. Because `quality` runs both lint and tests, a failing test fails the PR check.

## Adding tests

1. Put the logic in a browser-free file at the repository root (e.g. `distance.js`).
2. At the bottom of that file, export the functions for Node only:

   ```js
   if (typeof module !== "undefined") {
     module.exports = { myFunction };
   }
   ```

3. Load the file in `index.html` **before** `app.js`, and add its function names to the `app.js` globals in `eslint.config.mjs`.
4. Add the file to the `lint` and `lint:fix` scripts in `package.json`, and to the CommonJS block in `eslint.config.mjs`.
5. Create `tests/<name>.test.js`. `node --test` automatically finds files ending in `.test.js`.
6. Every new function needs at least one normal case **and** one edge or failure case (Definition of Done).

## Distance calculation tests

File: `tests/distance.test.js` — covers [`distance.js`](distance-calculation-design.md).

| Test | Checks | Why |
|---|---|---|
| `parseGPS` reads a `"lat, lng"` string | Real CSV format (with a space) parses to `[lat, lng]` | Matches the data actually in `vending_machines.csv` |
| `parseGPS` returns null for missing or invalid GPS | `""`, `undefined`, `"not a location"`, `"36.3"` all return `null` | **Failure case:** several machines have no GPS yet |
| `distanceInMeters` matches one degree of latitude | Result is within 0.01 m of π × 6,371,000 / 180 ≈ 111,195 m | Checks the formula against a value that can be worked out by hand |
| `distanceInMeters` is 0 for the same point | Same point twice gives exactly `0` | **Edge case:** user standing at the machine |
| `distanceInMeters` is the same in both directions | A→B equals B→A | Catches swapped latitude/longitude or sign mistakes |
| `distanceInMeters` handles short campus distances | The two Brinkley machines are 4–6 m apart (actual ≈ 5.0 m) | Real campus data; checks precision at short range |
| `calculateDistances` returns an empty Map without a user location | No location gives an empty result | **Edge case:** data loaded before location was granted |
| `calculateDistances` keys by string ID and stores null for machines without GPS | Keys are strings; a no-GPS machine is present with `null` | **Failure case:** missing data is kept, not dropped or crashed on |

Current result: **8/8 passing**, ESLint clean.

## Manual test checklist (mobile)

Run on a phone (iOS Safari and/or Android Chrome) against the deployed preview or a local server reached over the network. Geolocation only works on **HTTPS** or `localhost`, so test on the Vercel preview URL.

- [ ] Page loads; machine list and map appear with no console errors.
- [ ] Tap **📍 Use my location** and allow permission: a user marker appears and the status shows `Location found (±N m)`.
- [ ] Deny location permission: status shows "Location permission was denied." and the rest of the app still works.
- [ ] Search and type filters still work after the location is found.

Distances are not shown in the UI yet, so to check them, run this in the browser console after the location is found:

```js
state.distancesByMachine
```

Each machine ID should map to a distance in meters, or `null` for machines without GPS.

## Known gaps

- No automated browser/UI tests; UI behavior is checked manually using the checklist above.
- `parseGPS` treats a blank coordinate part as `0` — see [`bug-parsegps-blank-coordinate.md`](bug-parsegps-blank-coordinate.md). There is no test for this yet because it documents current behavior that is expected to change.
