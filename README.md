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
- Browse community reports about machines on the **Community reports** page (`forum.html`), linked from the header of every page. Reports show the machine, category, description, optional photo, and submission date, newest first, and can be filtered by machine.
- Submit a report from the forum page: pick a machine and category, describe the issue, and optionally attach a JPEG, PNG, or WebP photo (up to 4 MB). Reports are validated in the browser and again on the server, then stored in Vercel Blob so every user sees them. See [`docs/forum-design.md`](docs/forum-design.md).
- Run ESLint and unit tests locally and in GitHub Actions pull requests.

## Project Structure

```text
SnackAttack/
├── .github/workflows/
│   ├── accessibility.yml           # axe accessibility check (home + forum pages)
│   └── quality.yml                 # Pull-request quality check (ESLint + unit tests)
├── docs/
│   ├── bug-parsegps-blank-coordinate.md  # Open bug: blank GPS part parsed as 0
│   ├── distance-calculation-design.md  # Distance calculation design
│   ├── forum-design.md             # Community reports: data model, storage, display
│   ├── linting.md                  # Linting standard and usage
│   ├── product-pricing-design.md   # Product pricing/availability design
│   └── testing.md                  # Testing standard, test inventory, mobile checklist
├── api/
│   └── reports.mjs                 # Vercel Function: GET/POST /api/reports, stored in Vercel Blob
├── app.js                          # Machine finder browser behavior and rendering
├── csv-utils.mjs                   # CSV parser shared by app.js and forum.js (unit tested)
├── distance.js                     # GPS parsing and distance helpers (unit tested)
├── eslint.config.mjs               # ESLint configuration
├── forum.html                      # Community reports page markup
├── forum.js                        # Community reports browser behavior and rendering
├── forum-utils.mjs                 # Report validation, sorting, filtering, formatting (unit tested)
├── index.html                      # Machine finder markup
├── package.json                    # Node scripts, @vercel/blob, and dev dependencies
├── products.json                   # Product price/availability data
├── report-validation.mjs           # Report form/server validation rules (unit tested)
├── reports-api.mjs                 # /api/reports request handlers (unit tested with a mock store)
├── sort-utils.mjs                  # Nearest-to-farthest sorting (unit tested)
├── styles.css                      # Shared styles for every page
├── tests/                          # Unit tests (node:test) and Playwright accessibility tests
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

### Machine finder and forum (read-only)

The pages load CSV data with `fetch()`, so run a local web server:

```bash
python -m http.server 8000
```

Then browse to `http://localhost:8000` (machine finder) or `http://localhost:8000/forum.html` (community reports). With this server, `/api/reports` doesn't exist, so the forum shows "Reports could not be loaded right now" and submitting fails.

### Full app, including submitting reports

Report submission runs as a Vercel Function (`api/reports.mjs`) and stores data in **Vercel Blob**, so use the Vercel CLI:

```bash
npm install                     # installs @vercel/blob
npm i -g vercel                 # once, if you don't have the Vercel CLI
vercel login                    # use the account that owns the snack-attack project
vercel link                     # once: choose the snack-attack project
vercel env pull .env.local      # copies the Blob credentials (git-ignored)
vercel dev                      # http://localhost:3000
```

### Environment variables

| Variable | Needed for | Where it comes from |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | `/api/reports` (listing and saving reports and photos) | Added automatically when a Blob store is connected to the project (Vercel dashboard → Storage → Blob → Connect to `snack-attack`). Pull it locally with `vercel env pull .env.local`. |

A store connected with OIDC provides `BLOB_STORE_ID` instead of the token, and `@vercel/blob` accepts either. Never commit `.env.local`; `.env.*` files are in `.gitignore`.

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
