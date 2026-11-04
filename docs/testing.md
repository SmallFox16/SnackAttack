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
| `formatDistance` shows feet for short imperial distances | 0 m → `0 ft`, 5 m → `16 ft`, 100 m → `328 ft` | Normal campus distances in the default unit |
| `formatDistance` switches to miles at 0.1 mi (528 ft) | 160.6 m → `527 ft`, 160.8 m → `0.1 mi`, 1 mile → `1.0 mi` | **Edge case:** the boundary must never show `528 ft` |
| `formatDistance` shows meters and kilometers for metric | `120 m`, `999 m`, 999.6 m → `1.0 km`, `1.2 km` | **Edge case:** rounding at the 1 km boundary |
| `formatDistance` reports unavailable for machines without a distance | `null`, `undefined`, `NaN` → `Distance unavailable` | **Failure case:** machines without GPS |
| `formatDistance` rejects an unknown unit | `"furlongs"` throws | **Failure case:** a typo in `DISTANCE_UNIT` fails loudly |

Current result: **13/13 passing**, ESLint clean.

## Community reports tests

File: `tests/forum-utils.test.mjs` covers [`forum-utils.mjs`](forum-design.md). The tests follow the [unit testing standard](unit-test-standard.md): each test checks one behavior, has labeled Arrange / Act / Assert steps, and uses mock data only.

| Function | Behaviors tested (one test each) | Scenario type |
|---|---|---|
| `REPORT_CATEGORIES` | Lists the four story categories · cannot be changed at runtime | Normal |
| `categoryLabel` | Allowed key → label · unknown/missing key → `null` · inherited property (`toString`) → `null` | Normal, invalid input, **edge** |
| `normalizeReport` | Valid report cleaned up · no machine ID · blank/non-text description · unknown category · missing/unparseable date · non-object input · `javascript:`/`data:` image dropped (report kept) · relative image path kept · no image → `null` · missing ID generated | Normal, **missing data**, **invalid input**, **security** |
| `normalizeReports` | Newest first · invalid reports left out · same date keeps original order · no reports → `[]` · malformed data (`{}`, `null`, non-array) → `[]` | Normal, **boundary**, **empty data**, **error handling** |
| `filterReportsByMachine` | Selected machine only · numeric ID matches string ID · `"all"`/blank keeps all · machine with no reports → `[]` | Normal, **edge**, **empty result** |
| `machineLabel` | Known machine → "Brinkley Drink machine (#1)" · unknown ID → "Machine #7" | Normal, **missing data** |
| `formatReportDate` | Readable date (time zone pinned to UTC so it repeats on any machine) · invalid date → `Date unknown` | Normal, **invalid input** |
| `escapeHTML` | Markup escaped · `null` → `""` | **Security**, **missing data** |

File: `tests/csv-utils.test.mjs` covers the CSV parser shared by `app.js` and `forum.js`. There is one test for each of: header mapping, quoted commas, doubled quotes, CRLF line endings, blank rows, and empty input.

File: `tests/iot-sensor.test.mjs` covers [`iot-sensor.mjs`](iot-message-format.md): the simulated sensor, message validation, storing the latest reading, and applying stock updates with `applySensorMessage` (machine and product changes, unchanged readings, unknown machines and products, machines with no products).

### Not unit tested, and why

The unit testing standard (section 5) asks us to name code that can't reasonably be unit tested:

- **`forum.js`**: it reads the page (`document`), fetches files over HTTP, and writes HTML into the page as soon as it loads. It can't run in Node without a browser. All of its decisions (validation, sorting, filtering, labels, dates, escaping) are in `forum-utils.mjs` and tested above. What's left is loading data and inserting HTML, which is covered by:
  - `tests/accessibility.spec.js`, which loads `forum.html` in Chromium and runs axe (WCAG 2.1 A/AA)
  - the manual mobile checklist below
- **`updateMachineCard` and `handleSensorMessage` in `app.js`**: `app.js` needs the page and Leaflet as soon as it loads, so it can't run in Node. The stock logic they call is in `iot-sensor.mjs` and tested above. What's left is writing the new values into the machine's card.
- **`styles.css` / `forum.html`**: static markup and styling, which section 1 of the standard says does not need unit tests.

Current result: **53/53 unit tests passing**, ESLint clean, 2/2 accessibility tests passing.

## Manual test checklist (mobile)

Run on a phone (iOS Safari and/or Android Chrome) against the deployed preview or a local server reached over the network. Geolocation only works on **HTTPS** or `localhost`, so test on the Vercel preview URL.

- [ ] Page loads; machine list and map appear with no console errors.
- [ ] Tap **📍 Use my location** and allow permission: a user marker appears and the status shows `Location found (±N m)`.
- [ ] Deny location permission: status shows "Location permission was denied." and the rest of the app still works.
- [ ] Search and type filters still work after the location is found.
- [ ] Before tapping **📍 Use my location**, cards show **no** distance line.
- [ ] After the location is found, machines with GPS show `📍 N ft away` (or `mi`) on the card and in the map popup (**Show on map**).
- [ ] Machines without GPS show `📍 Distance unavailable`.
- [ ] Distance text fits on the card at phone width without overflowing.
- [ ] The header nav shows **Machine finder** and **Community reports**; tapping each goes to that page, and the current page is highlighted gold.
- [ ] The **Community reports** page shows "No reports yet…" when `reports.json` is empty.
- [ ] With reports present, cards show the machine, category badge, description, and submitted date, newest first, with no horizontal scrolling.
- [ ] **Filter by machine** narrows the list; a machine with no reports shows "No reports for this machine yet."

To check the raw distances in meters, run `state.distancesByMachine` in the browser console after the location is found.

## Known gaps

- No automated browser/UI tests; UI behavior is checked manually using the checklist above.
- `parseGPS` treats a blank coordinate part as `0` — see [`bug-parsegps-blank-coordinate.md`](bug-parsegps-blank-coordinate.md). There is no test for this yet because it documents current behavior that is expected to change.
