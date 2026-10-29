# SnackAttack

SnackAttack is a lightweight web application for finding vending machines around ETSU. The Sprint 3 version displays machine information, an interactive map, machine-level availability, product prices, and product-level availability while adding automated JavaScript quality checks.

## Current Features

- Search vending machines by building.
- Filter by standardized machine types: `Drink`, `Snack`, and `Personal Care`.
- Display machine-level availability.
- Expand machine cards for payment, GPS, directions, and notes.
- Display mapped machines with Leaflet/OpenStreetMap.
- Load machine records from `vending_machines.csv`.
- Load product records from `products.json` and join them by machine ID.
- Display product name, price, and product availability.
- Preserve unknown/unsurveyed prices as `null` rather than inventing values.
- Locate the user on the map and calculate the straight-line distance (Haversine, in meters) from the user to each vending machine.
- Show each machine's distance from the user (e.g. `📍 210 ft away`) on its card and map popup. The unit is set by `DISTANCE_UNIT` at the top of `app.js` (`"imperial"` for ft/mi or `"metric"` for m/km).
- Run ESLint and unit tests locally and in GitHub Actions pull requests.

## Project Structure

```text
SnackAttack/
├── .github/workflows/quality.yml   # Pull-request quality check
├── docs/
│   ├── bug-parsegps-blank-coordinate.md  # Open bug: blank GPS part parsed as 0
│   ├── distance-calculation-design.md  # Distance calculation design
│   ├── linting.md                  # Linting standard and usage
│   ├── product-pricing-design.md   # Product pricing/availability design
│   └── testing.md                  # Testing standard, test inventory, mobile checklist
├── app.js                          # Browser behavior and data rendering
├── distance.js                     # GPS parsing and distance helpers (unit tested)
├── eslint.config.mjs                # ESLint configuration
├── index.html                      # Front-end markup and styles
├── package.json                    # Node scripts and ESLint dependency
├── products.json                   # Product price/availability data
├── tests/                          # Unit tests (Node's built-in test runner)
├── vending_machines.csv            # Machine/location data
└── vercel.json                     # Vercel static deployment config
```

## Product Data

`products.json` uses the machine ID from `vending_machines.csv` as `machineId`.

Example:

```json
{
  "machineId": 1,
  "name": "Water",
  "price": 1.75,
  "availability": "Available"
}
```

Allowed availability values are:

- `Available`
- `Unavailable`
- `Unknown`

A price that has not been physically verified should remain `null`.

## Run Locally

The page loads CSV/JSON with `fetch()`, so run a local web server:

```bash
python -m http.server 8000
```

Then browse to `http://localhost:8000`.

## Quality Checks

Install dependencies:

```bash
npm install
```

Run the same quality check used in CI (ESLint, then unit tests):

```bash
npm run quality
```

Run only the unit tests:

```bash
npm test
```

Tests use Node's built-in `node:test` runner, so no extra test dependencies are needed (Node 22+). Test files live in `tests/` and are named `*.test.js`. See [`docs/testing.md`](docs/testing.md) for how to add tests and the manual mobile checklist.

See `docs/linting.md` for the standards and workflow.

## Pull Requests

`.github/workflows/quality.yml` runs ESLint automatically on pull requests to `main` or `dev`. Configure GitHub branch protection for `main` to require the **ESLint** check before a PR can merge.

## Production Deployment

Use `main` as the Vercel production branch. Development changes should be made on the sprint/development branch, reviewed by pull request, pass the ESLint status check, and then merge into `main`.
