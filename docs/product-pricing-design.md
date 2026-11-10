# Product Price and Availability — High-Level Design

## Goal

Extend SnackAttack from machine-level data to product-level data without duplicating machine information or inventing prices that have not been surveyed.

## Data model

Machine/location records remain in `data/vending_machines.csv`. Product-level records are stored in `data/products.json` and are linked by `machineId`. Only the machine API reads these files.

```text
data/vending_machines.csv
  ID = 1
      │
      └──── data/products.json
              machineId = 1
              name
              price
              availability
```

Each product record contains:

- `machineId`: foreign key to `data/vending_machines.csv` `ID`
- `name`: observed product or product category
- `price`: numeric dollar amount, or `null` until surveyed
- `availability`: `Available`, `Unavailable`, or `Unknown`

## Runtime flow

```text
data/vending_machines.csv ──> GET /api/machines ──┐
                                                  ├── fetch() ──> browser state ──> machine cards
data/products.json ─────────> GET /api/products ──┘                              └─> product rows
```

`app.js` loads both endpoints in parallel. Product records are grouped by `machineId`. When a machine card is expanded, its product list displays the product name, formatted price, and an availability badge.

## Product availability display

The product display follows the existing machine status vocabulary:

- **Available** — green status badge
- **Unavailable** — red status badge
- **Unknown** — neutral gray status badge

Unknown price data is rendered as **Price not recorded** rather than showing a guessed value.

## Data-collection procedure

For each vending machine:

1. Record the exact product label or a consistent product category.
2. Record the displayed vend price as a decimal number, e.g. `1.75`.
3. Record product availability as `Available`, `Unavailable`, or `Unknown`.
4. Add or update the matching `data/products.json` record using the machine's CSV `ID`.
5. Run `npm run quality` before committing.

The repository intentionally leaves unsurveyed prices as `null` and availability as `Unknown` so the UI does not present invented field data.
