import test from "node:test";
import assert from "node:assert/strict";
import { formatLastUpdated } from "../iot-display.mjs";

/* Unit tests for the IoT display helpers (Task #2). */

// Fixed "current time" so every run gives the same result
const now = new Date("2026-11-09T15:00:00.000Z");

/**
 * Builds an ISO timestamp the given number of seconds before `now`.
 */
function secondsAgo(seconds) {
  return new Date(now.getTime() - seconds * 1000).toISOString();
}

test("formatLastUpdated says just now for a reading under 10 seconds old", () => {
  // Arrange
  const timestamp = secondsAgo(3);

  // Act
  const label = formatLastUpdated(timestamp, now);

  // Assert
  assert.equal(label, "Updated just now");
});

test("formatLastUpdated switches to seconds at exactly 10 seconds", () => {
  const label = formatLastUpdated(secondsAgo(10), now);
  assert.equal(label, "Updated 10 sec ago");
});

test("formatLastUpdated shows seconds for a reading under a minute old", () => {
  const label = formatLastUpdated(secondsAgo(45), now);
  assert.equal(label, "Updated 45 sec ago");
});

test("formatLastUpdated switches to minutes at exactly 60 seconds", () => {
  const label = formatLastUpdated(secondsAgo(60), now);
  assert.equal(label, "Updated 1 min ago");
});

test("formatLastUpdated rounds partial minutes down", () => {
  const label = formatLastUpdated(secondsAgo(179), now);
  assert.equal(label, "Updated 2 min ago");
});

test("formatLastUpdated shows hours for a reading over an hour old", () => {
  const label = formatLastUpdated(secondsAgo(2 * 60 * 60 + 5), now);
  assert.equal(label, "Updated 2 hr ago");
});

test("formatLastUpdated treats a timestamp slightly in the future as just now", () => {
  const label = formatLastUpdated(secondsAgo(-5), now);
  assert.equal(label, "Updated just now");
});

test("formatLastUpdated returns an empty string for an invalid timestamp", () => {
  const label = formatLastUpdated("not a date", now);
  assert.equal(label, "");
});

test("formatLastUpdated returns an empty string for a missing timestamp", () => {
  const label = formatLastUpdated(undefined, now);
  assert.equal(label, "");
});