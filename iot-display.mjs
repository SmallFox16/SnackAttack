/* Display helpers for simulated IoT updates (Task #2).
 * Kept separate from app.js so they can be unit tested.
 */

/**
 * Turns a sensor message's timestamp into a short "last updated" label.
 *
 * @param {string} timestamp - ISO 8601 time the reading was taken.
 * @param {Date} [now=new Date()] - Current time (replaceable in tests).
 * @returns {string} e.g. "Updated just now", "Updated 25 sec ago", "Updated 3 min ago",
 *   or an empty string if the timestamp is missing or invalid.
 */
export function formatLastUpdated(timestamp, now = new Date()) {
  const time = Date.parse(timestamp);
  if (Number.isNaN(time)) return "";

  // Clamp to 0 so a sensor clock that's slightly ahead still reads "just now"
  const seconds = Math.max(0, Math.floor((now.getTime() - time) / 1000));

  if (seconds < 10) return "Updated just now";
  if (seconds < 60) return `Updated ${seconds} sec ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes} min ago`;

  return `Updated ${Math.floor(minutes / 60)} hr ago`;
}