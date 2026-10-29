/* SnackAttack distance helpers (Task #13).
 * Loaded as a plain script before app.js in the browser, and required by the
 * unit tests in Node. Keep this file free of DOM/Leaflet access so it stays testable.
 */

function parseGPS(gps) {
  const [lat, lng] = (gps || "").split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

/**
 * Calculates the straight-line distance between two GPS points using the
 * Haversine formula, which accounts for the Earth's curvature.
 *
 * @param {[number, number]} from - [lat, lng] of the first point.
 * @param {[number, number]} to - [lat, lng] of the second point.
 * @returns {number} Distance in meters.
 */
function distanceInMeters([lat1, lng1], [lat2, lng2]) {
  const earthRadius = 6371000; // Mean radius of the Earth in meters

  // Trig functions in JavaScript expect radians, not degrees
  const toRad = (degrees) => (degrees * Math.PI) / 180;

  // Differences between the two points, in radians
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  // Haversine formula: "a" is the square of half the chord length between the points
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  // Convert to the angular distance, then multiply by the radius to get meters
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

/**
 * Calculates the distance from the user to every vending machine.
 * Uses all machines (not just the filtered ones) so distances are always
 * available no matter which filters are active.
 *
 * @param {{lat: number, lng: number} | null} userLocation - The user's position.
 * @param {Array<{ID: string|number, GPS: string}>} machines - Machine records.
 * @returns {Map<string, number|null>} Machine ID -> distance in meters.
 *   Empty if there is no user location; null for machines without GPS data.
 */
function calculateDistances(userLocation, machines) {
  const distances = new Map();

  // Can't calculate anything without the user's position
  if (!userLocation) return distances;

  const userPosition = [userLocation.lat, userLocation.lng];

  machines.forEach((machine) => {
    const machinePosition = parseGPS(machine.GPS);

    // Store null for machines missing GPS data so they still appear in the Map
    const distance = machinePosition ? distanceInMeters(userPosition, machinePosition) : null;

    distances.set(String(machine.ID), distance);
  });

  return distances;
}

/* ---- Distance display (Task #12) ---- */

const METERS_PER_FOOT = 0.3048;
const METERS_PER_MILE = 1609.344;
const FEET_PER_MILE = 5280;

/**
 * Formats a distance for display in the given unit system.
 * Short distances use feet/meters; anything from 0.1 mi (528 ft) or 1 km up
 * uses miles/kilometers with one decimal place.
 *
 * @param {number|null} meters - Distance in meters, or null if unknown.
 * @param {"imperial"|"metric"} unit - Unit system to display.
 * @returns {string} e.g. "350 ft", "0.4 mi", "120 m", "1.2 km",
 *   or "Distance unavailable" when meters is null or not a number.
 */
function formatDistance(meters, unit) {
  if (unit !== "imperial" && unit !== "metric") {
    throw new Error(`Unknown distance unit: ${unit}`);
  }

  // Machines without GPS data have a null distance
  if (!Number.isFinite(meters)) return "Distance unavailable";

  if (unit === "imperial") {
    // Round first so 527.6 ft shows as "0.1 mi" instead of "528 ft"
    const feet = Math.round(meters / METERS_PER_FOOT);
    return feet < FEET_PER_MILE / 10
      ? `${feet} ft`
      : `${(meters / METERS_PER_MILE).toFixed(1)} mi`;
  }

  const roundedMeters = Math.round(meters);
  return roundedMeters < 1000
    ? `${roundedMeters} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

// Expose the helpers to Node for unit tests; in the browser they are globals.
if (typeof module !== "undefined") {
  module.exports = { parseGPS, distanceInMeters, calculateDistances, formatDistance };
}
