import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCSV } from "../csv-utils.mjs";
import {
  MACHINE_FIELDS,
  MACHINE_TYPES,
  AVAILABILITY_VALUES,
  isValidGPS,
  getMachineErrors,
  isValidMachine,
  getMachineListErrors
} from "../machine-data.mjs";

/* Unit tests for the vending machine data format (docs/machine-data-format.md). */

/**
 * Builds a machine row that matches the format, with optional fields overridden.
 */
function validMachine(overrides = {}) {
  return {
    ID: "1",
    Building: "Brinkley",
    Type: "Drink",
    Availability: "Unknown",
    GPS: "36.305545, -82.371430",
    Payment: "Card and Cash",
    Directions: "Walk straight from the parking garage doors.",
    Details: "45 drink slots.",
    ...overrides
  };
}

/* ---- isValidGPS ---- */

test("isValidGPS accepts a latitude and longitude pair", () => {
  assert.equal(isValidGPS("36.305545, -82.371430"), true);
});

test("isValidGPS accepts a pair without a space after the comma", () => {
  assert.equal(isValidGPS("36.305545,-82.371430"), true);
});

test("isValidGPS accepts a blank value because GPS is optional", () => {
  assert.equal(isValidGPS(""), true);
  assert.equal(isValidGPS("   "), true);
  assert.equal(isValidGPS(undefined), true);
});

test("isValidGPS rejects a pair with one side blank", () => {
  assert.equal(isValidGPS("36.305545,"), false);
  assert.equal(isValidGPS(", -82.371430"), false);
});

test("isValidGPS rejects text that is not a coordinate pair", () => {
  assert.equal(isValidGPS("Brinkley Center"), false);
  assert.equal(isValidGPS("36.305545"), false);
  assert.equal(isValidGPS("36.3, -82.3, 10"), false);
});

test("isValidGPS accepts the edges of the valid range", () => {
  assert.equal(isValidGPS("90, 180"), true);
  assert.equal(isValidGPS("-90, -180"), true);
});

test("isValidGPS rejects coordinates outside the valid range", () => {
  assert.equal(isValidGPS("90.1, 0"), false);
  assert.equal(isValidGPS("0, -180.5"), false);
});

/* ---- getMachineErrors / isValidMachine ---- */

test("isValidMachine accepts a complete machine row", () => {
  assert.equal(isValidMachine(validMachine()), true);
});

test("isValidMachine accepts every machine type", () => {
  MACHINE_TYPES.forEach((type) => {
    assert.equal(isValidMachine(validMachine({ Type: type })), true, type);
  });
});

test("isValidMachine accepts every availability value", () => {
  AVAILABILITY_VALUES.forEach((availability) => {
    assert.equal(isValidMachine(validMachine({ Availability: availability })), true, availability);
  });
});

test("isValidMachine accepts blank optional fields", () => {
  const machine = validMachine({ GPS: "", Payment: "", Directions: "", Details: "" });

  assert.equal(isValidMachine(machine), true);
});

test("getMachineErrors reports each missing required field", () => {
  const machine = validMachine({ ID: "", Building: " ", Type: "", Availability: "" });

  const errors = getMachineErrors(machine);

  assert.deepEqual(errors, [
    "ID is required",
    "Building is required",
    "Type is required",
    "Availability is required"
  ]);
});

test("getMachineErrors rejects an ID that is not a positive whole number", () => {
  ["0", "-3", "1.5", "abc", "01"].forEach((id) => {
    assert.match(getMachineErrors(validMachine({ ID: id }))[0], /ID must be a positive whole number/, id);
  });
});

test("getMachineErrors rejects an unknown machine type", () => {
  const errors = getMachineErrors(validMachine({ Type: "Coffee" }));

  assert.deepEqual(errors, ['Type must be one of Drink, Snack, Personal Care (got "Coffee")']);
});

test("getMachineErrors treats machine type as case-sensitive", () => {
  assert.equal(isValidMachine(validMachine({ Type: "drink" })), false);
});

test("getMachineErrors rejects an unknown availability value", () => {
  const errors = getMachineErrors(validMachine({ Availability: "Broken" }));

  assert.deepEqual(errors, ['Availability must be one of Available, Unavailable, Unknown (got "Broken")']);
});

test("getMachineErrors rejects an invalid GPS value", () => {
  const errors = getMachineErrors(validMachine({ GPS: "36.305545," }));

  assert.deepEqual(errors, ['GPS must be "latitude, longitude" or blank (got "36.305545,")']);
});

test("getMachineErrors rejects values that are not strings", () => {
  const errors = getMachineErrors(validMachine({ ID: 1 }));

  assert.ok(errors.includes("ID must be a string"));
});

test("getMachineErrors rejects input that is not an object", () => {
  assert.deepEqual(getMachineErrors(null), ["Machine must be an object"]);
  assert.deepEqual(getMachineErrors("1,Brinkley"), ["Machine must be an object"]);
});

/* ---- getMachineListErrors ---- */

test("getMachineListErrors accepts a list of valid machines with unique IDs", () => {
  const machines = [validMachine({ ID: "1" }), validMachine({ ID: "2" })];

  assert.deepEqual(getMachineListErrors(machines), []);
});

test("getMachineListErrors accepts an empty list", () => {
  assert.deepEqual(getMachineListErrors([]), []);
});

test("getMachineListErrors reports a duplicate ID with both row numbers", () => {
  const machines = [validMachine({ ID: "1" }), validMachine({ ID: "2" }), validMachine({ ID: "1" })];

  assert.deepEqual(getMachineListErrors(machines), ["Row 3: ID 1 is already used by row 1"]);
});

test("getMachineListErrors prefixes row errors with the row number", () => {
  const machines = [validMachine(), validMachine({ ID: "2", Type: "Coffee" })];

  assert.deepEqual(getMachineListErrors(machines), ['Row 2: Type must be one of Drink, Snack, Personal Care (got "Coffee")']);
});

test("getMachineListErrors rejects input that is not an array", () => {
  assert.deepEqual(getMachineListErrors(undefined), ["Machine list must be an array"]);
});

/* ---- data/vending_machines.csv ---- */

test("data/vending_machines.csv has the expected header row", () => {
  const csv = readFileSync(new URL("../data/vending_machines.csv", import.meta.url), "utf8");

  const header = csv.split(/\r?\n/)[0].split(",").map((field) => field.trim());

  assert.deepEqual(header, MACHINE_FIELDS);
});

test("data/vending_machines.csv matches the machine data format", () => {
  const csv = readFileSync(new URL("../data/vending_machines.csv", import.meta.url), "utf8");

  const errors = getMachineListErrors(parseCSV(csv));

  assert.deepEqual(errors, []);
});
