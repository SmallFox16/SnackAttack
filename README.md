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
- Run ESLint locally and in GitHub Actions pull requests.

## Project Structure

```text
SnackAttack/
├── .github/workflows/quality.yml   # Pull-request quality check
├── docs/
│   ├── linting.md                  # Linting standard and usage
│   └── product-pricing-design.md   # Product pricing/availability design
├── app.js                          # Browser behavior and data rendering
├── eslint.config.mjs                # ESLint configuration
├── index.html                      # Front-end markup and styles
├── package.json                    # Node scripts and ESLint dependency
├── products.json                   # Product price/availability data
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

Run the same quality check used in CI:

```bash
npm run quality
```

See `docs/linting.md` for the standards and workflow.

## Pull Requests

`.github/workflows/quality.yml` runs ESLint automatically on pull requests to `main` or `dev`. Configure GitHub branch protection for `main` to require the **ESLint** check before a PR can merge.

## Production Deployment

Use `main` as the Vercel production branch. Development changes should be made on the sprint/development branch, reviewed by pull request, pass the ESLint status check, and then merge into `main`.

## Sprint 4 — Distance sorting

Sprint 4 adds user-location-based vending machine sorting:

- **Sort control:** choose **Default order** or **Nearest to farthest**.
- **Location prerequisite:** nearest-to-farthest is disabled until the browser successfully provides the user's location.
- **Displayed list updates immediately:** after location is available, selecting distance sort reorders the visible, filtered machine cards using the calculated PBI-05 distances.
- **Missing GPS behavior:** machines without a calculable distance remain visible and are placed after machines with known distances, preserving their original relative order.
- **Distance display:** machine cards show the calculated distance when available; otherwise they show `Distance unavailable`.
- **Automated verification:** `npm test` validates sorting accuracy, missing-distance behavior, no-location behavior, and non-mutation of the source list.

Run the Sprint 4 quality gate with:

```bash
npm run quality
```

This now runs both ESLint and the Node test suite.
