# Distance Calculation — High-Level Design

## Goal

Calculate how far the user is from every vending machine so later features (closest machine, sorting by distance, showing "X ft away") can build on one shared, tested source of distances.

This task covers **calculation only**. Displaying distances and finding the closest machine are separate PBIs.

## Distance definition

"Distance" means the **straight-line (great-circle) distance** between the user's GPS position and the machine's GPS position, calculated with the **Haversine formula**.

Why straight-line instead of walking route:

- It needs only the coordinates already in `vending_machines.csv`; no routing service, API key, or network call.
- It is fast enough to recalculate for every machine whenever the location changes.
- On a compact campus, straight-line distance is a good approximation for ranking machines by proximity.

Walking-route distance would require a routing API (and a key that must stay out of the code), so it is deferred until a PBI explicitly needs it.

Why Haversine instead of simple flat (Pythagorean) math:

- Latitude/longitude degrees are not equal lengths, so flat math on raw degrees is wrong.
- Haversine accounts for the Earth's curvature and stays accurate at any distance, while costing only a few trig calls.

The Earth is treated as a sphere with a mean radius of **6,371,000 m**. The error from this simplification is well under 1% — negligible for campus distances.

## Units

All distances are calculated and stored in **meters**. Converting to a display unit (feet/miles or meters/kilometers) is the job of the display layer, so the calculation never changes when the display unit does.

## Code structure

```text
distance.js   (pure logic — no DOM, no Leaflet)
  parseGPS(gps)                          "lat, lng" string -> [lat, lng] or null
  distanceInMeters(from, to)             Haversine distance in meters
  calculateDistances(userLocation, machines)
                                         Map<machine ID, meters | null>

app.js        (browser wiring)
  calculateMachineDistances()            stores calculateDistances(...) in state.distancesByMachine
```

The helpers live in `distance.js` because `app.js` touches the DOM and Leaflet as soon as it loads, which makes it impossible to load in Node for unit testing. `distance.js` is loaded as a plain script before `app.js` (so its functions are browser globals), and it also exports them via `module.exports` for the Node tests.

## Runtime flow

```text
"📍 Use my location" ──> getUserLocation() ──> state.userLocation ──┐
                                                                     ├──> calculateMachineDistances()
vending_machines.csv ──> loadData() ──> state.machines ──────────────┘            │
                                                                                  v
                                                     state.distancesByMachine (Map)
                                                       "1" -> 4.99
                                                       "3" -> null   (no GPS)
```

Distances are recalculated in **both** places that change the inputs:

- after the user's location is found, and
- after the machine data finishes loading (covers the case where the location arrived first).

Each recalculation **replaces** the whole Map, so distances from an old location never mix with a new one.

Distances are calculated for **all** machines, not just the ones matching the current search/type filter, so they are always available no matter which filters are active.

## Data rules

| Situation | Result |
|---|---|
| User location not known yet | `distancesByMachine` is empty |
| Machine has valid GPS | Distance in meters |
| Machine GPS is empty or not a number | Entry is `null` (machine is still listed, so it is not silently dropped) |

Map keys are the machine `ID` converted to a **string**, matching how IDs are used elsewhere in `app.js`.

## Known limitations

- **Blank coordinate parts parse as 0.** `parseGPS("36.3,")` returns `[36.3, 0]` instead of `null`, because `Number("")` is `0`. No current CSV row triggers this, but a typo in the data would place a machine at longitude 0 with a very large distance. Fixing it is a behavior change and should be its own task. Full write-up: [`bug-parsegps-blank-coordinate.md`](bug-parsegps-blank-coordinate.md).
- **GPS accuracy is not factored in.** The browser reports an accuracy radius (shown as `±N m`), but distances are calculated from the reported point only.
- **Straight-line only.** Buildings, stairs, and floors are not considered.

## Related

- Tests and the manual test checklist: [`testing.md`](testing.md)
