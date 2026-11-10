# Machine Data Format

All vending machines are listed in `vending_machines.csv`, one machine per row. `app.js` loads the file with `parseCSV()` (`csv-utils.mjs`), which turns each row into an object keyed by the header row. The format is defined in `machine-data.mjs` (`VendingMachine`).

## Example

```csv
ID,Building,Type,Availability,GPS,Payment,Directions,Details
1,Brinkley,Drink,Unknown,"36.305545, -82.371430","Card and Cash","From the set of double doors closest to the Brinkley Center parking garage on the first floor, walk straight. The vending machine will be on the right.","45 drink slots; mostly Gatorade and water; also Monster, V8, and sodas."
3,Brown,Drink,Unknown,,,"Location details pending verification.","Machine type recorded from Sprint 1 survey data."
```

After parsing, the first row becomes:

```json
{
  "ID": "1",
  "Building": "Brinkley",
  "Type": "Drink",
  "Availability": "Unknown",
  "GPS": "36.305545, -82.371430",
  "Payment": "Card and Cash",
  "Directions": "From the set of double doors closest to the Brinkley Center parking garage on the first floor, walk straight. The vending machine will be on the right.",
  "Details": "45 drink slots; mostly Gatorade and water; also Monster, V8, and sodas."
}
```

Every value is a string, including `ID`, because it comes from a CSV file.

## Fields

The header row must list these columns in this order.

| Field | Required | Allowed values | Description | Used by |
|---|---|---|---|---|
| `ID` | Yes | Positive whole number with no leading zeros, unique in the file | Identifies the machine | Cards, map markers, `products.json` (`machineId`), forum `?machine=` links |
| `Building` | Yes | Any text | Campus building the machine is in | Card title, map popup, building search |
| `Type` | Yes | `Drink`, `Snack`, `Personal Care` (case-sensitive) | What the machine sells | Type filter buttons, map marker icon |
| `Availability` | Yes | `Available`, `Unavailable`, `Unknown` | Whether the machine is working | Status badge on the card |
| `GPS` | No | `latitude, longitude` in decimal degrees, or blank | Where the machine is | Map marker, distance and nearest-to-farthest sorting |
| `Payment` | No | Any text, e.g. `Card and Cash` | Accepted payment | Card details, map popup |
| `Directions` | No | Any text | How to find the machine inside the building | Card details, map popup |
| `Details` | No | Any text | Extra notes, such as slot count and typical stock | Card details |

Blank optional fields show as "Not yet recorded" on the page. A machine with no `GPS` is still listed, but it has no map marker and no distance.

## Rules

- **Unique IDs.** `products.json` and forum links find a machine by `ID`, so two rows must never share one. Don't reuse the ID of a removed machine.
- **Allowed types only.** A `Type` outside the list has no filter button, so users can only find the machine with "All". Adding a new type means updating `MACHINE_TYPES` in `machine-data.mjs`, the filter buttons in `index.html`, and `markerEmoji` in `app.js`.
- **`Unknown` until verified.** New machines start with `Availability` set to `Unknown`. Change it to `Available` or `Unavailable` only after someone checks the machine.
- **Both GPS coordinates or neither.** A value with one side blank, such as `36.305545,`, is invalid. `parseGPS()` would read the blank side as `0` (see [the parseGPS bug](bug-parsegps-blank-coordinate.md)).
- **Quote values that contain commas.** `GPS`, `Directions`, and `Details` usually contain commas, so wrap them in double quotes. Write a double quote inside a value as `""`.

## Validation

`machine-data.mjs` checks data against this format:

- `isValidMachine(machine)` returns `true` if one row matches the format.
- `getMachineErrors(machine)` lists what is wrong with one row.
- `getMachineListErrors(machines)` checks every row and also reports duplicate IDs. Each error starts with its row number (row 1 is the first machine after the header).

`tests/machine-data.test.mjs` runs these checks against the real `vending_machines.csv`, so `npm test` fails if a change to the file breaks the format.

## Adding a machine

1. Add a row with the next unused `ID`, its `Building`, `Type`, and `Availability` set to `Unknown`.
2. Fill in `GPS`, `Payment`, `Directions`, and `Details` if they are known. Leave them blank otherwise.
3. Add the machine's products to `products.json` with `machineId` set to the new `ID`.
4. Run `npm test` to confirm the file still matches the format.
