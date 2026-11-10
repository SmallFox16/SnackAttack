/* Vending machine data format for SnackAttack.
 * Defines the columns of vending_machines.csv and validates machine rows.
 * Kept separate from app.js so it can be unit tested.
 * Full format description: docs/machine-data-format.md
 */

/**
 * One vending machine, as parsed from a row of vending_machines.csv by parseCSV().
 * Every value is a string because it comes from a CSV file.
 *
 * @typedef {object} VendingMachine
 * @property {string} ID - Unique whole number. Used as machineId in products.json.
 * @property {string} Building - Campus building the machine is in (e.g. "Brinkley").
 * @property {"Drink"|"Snack"|"Personal Care"} Type - What the machine sells.
 * @property {"Available"|"Unavailable"|"Unknown"} Availability - Whether the machine is working.
 * @property {string} GPS - "latitude, longitude" in decimal degrees, or "" if not recorded.
 * @property {string} Payment - Accepted payment (e.g. "Card and Cash"), or "" if not recorded.
 * @property {string} Directions - How to find the machine inside the building.
 * @property {string} Details - Extra notes, such as slot count and typical stock.
 */

// Column order of the header row in vending_machines.csv
export const MACHINE_FIELDS = ["ID", "Building", "Type", "Availability", "GPS", "Payment", "Directions", "Details"];

// Columns that must have a value in every row
export const REQUIRED_FIELDS = ["ID", "Building", "Type", "Availability"];

// Same types as the filter buttons in index.html and markerEmoji in app.js
export const MACHINE_TYPES = ["Drink", "Snack", "Personal Care"];

// "Unknown" is used until someone checks the machine's status
export const AVAILABILITY_VALUES = ["Available", "Unavailable", "Unknown"];

// Two decimal numbers separated by a comma, e.g. "36.305545, -82.371430"
const GPS_PATTERN = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

/**
 * Checks a GPS value. Blank means "not recorded" and is allowed; anything else
 * must be a real latitude and longitude. Stricter than parseGPS() in distance.js,
 * which accepts a blank side as 0 (see docs/bug-parsegps-blank-coordinate.md).
 *
 * @param {string} gps - The GPS column value.
 * @returns {boolean} True if the value is blank or a valid coordinate pair.
 */
export function isValidGPS(gps) {
  if (gps === undefined || gps === null || String(gps).trim() === "") return true;

  const match = GPS_PATTERN.exec(String(gps));
  if (!match) return false;

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/**
 * Lists everything wrong with one machine row.
 *
 * @param {object} machine - A row parsed from vending_machines.csv.
 * @returns {string[]} One message per problem; empty if the row is valid.
 */
export function getMachineErrors(machine) {
  if (!machine || typeof machine !== "object") return ["Machine must be an object"];

  const errors = [];
  const value = (field) => (typeof machine[field] === "string" ? machine[field].trim() : "");

  MACHINE_FIELDS.forEach((field) => {
    if (machine[field] !== undefined && typeof machine[field] !== "string") {
      errors.push(`${field} must be a string`);
    }
  });

  REQUIRED_FIELDS.forEach((field) => {
    if (!value(field)) errors.push(`${field} is required`);
  });

  if (value("ID") && !/^[1-9]\d*$/.test(value("ID"))) {
    errors.push(`ID must be a positive whole number (got "${machine.ID}")`);
  }

  if (value("Type") && !MACHINE_TYPES.includes(value("Type"))) {
    errors.push(`Type must be one of ${MACHINE_TYPES.join(", ")} (got "${machine.Type}")`);
  }

  if (value("Availability") && !AVAILABILITY_VALUES.includes(value("Availability"))) {
    errors.push(`Availability must be one of ${AVAILABILITY_VALUES.join(", ")} (got "${machine.Availability}")`);
  }

  if (typeof machine.GPS === "string" && !isValidGPS(machine.GPS)) {
    errors.push(`GPS must be "latitude, longitude" or blank (got "${machine.GPS}")`);
  }

  return errors;
}

/**
 * Checks that one machine row matches the VendingMachine format.
 *
 * @param {object} machine - A row parsed from vending_machines.csv.
 * @returns {boolean} True if the row is valid.
 */
export function isValidMachine(machine) {
  return getMachineErrors(machine).length === 0;
}

/**
 * Checks a whole machine list: every row must be valid and every ID unique,
 * because products.json and forum links find machines by ID.
 *
 * @param {object[]} machines - Rows parsed from vending_machines.csv.
 * @returns {string[]} Problems found, each prefixed with the row it came from
 *   (row 1 is the first machine after the header); empty if the list is valid.
 */
export function getMachineListErrors(machines) {
  if (!Array.isArray(machines)) return ["Machine list must be an array"];

  const errors = [];
  const seenIds = new Map(); // ID -> first row it appeared on

  machines.forEach((machine, index) => {
    const row = index + 1;
    getMachineErrors(machine).forEach((error) => errors.push(`Row ${row}: ${error}`));

    const id = typeof machine?.ID === "string" ? machine.ID.trim() : "";
    if (!id) return;
    if (seenIds.has(id)) {
      errors.push(`Row ${row}: ID ${id} is already used by row ${seenIds.get(id)}`);
    } else {
      seenIds.set(id, row);
    }
  });

  return errors;
}
