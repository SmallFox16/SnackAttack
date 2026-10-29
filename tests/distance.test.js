const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseGPS, distanceInMeters, calculateDistances, formatDistance } = require("../distance.js");

// One degree of latitude on a sphere with the Haversine radius (6,371 km)
const METERS_PER_DEGREE = (Math.PI * 6371000) / 180;

const brinkleyDrink = [36.305545, -82.37143];
const brinkleySnack = [36.30558, -82.371395];

test("parseGPS reads a 'lat, lng' string", () => {
  assert.deepEqual(parseGPS("36.305545, -82.371430"), brinkleyDrink);
});

test("parseGPS returns null for missing or invalid GPS", () => {
  assert.equal(parseGPS(""), null);
  assert.equal(parseGPS(undefined), null);
  assert.equal(parseGPS("not a location"), null);
  assert.equal(parseGPS("36.3"), null);
});

test("distanceInMeters matches one degree of latitude", () => {
  const distance = distanceInMeters([36, -82], [37, -82]);
  assert.ok(Math.abs(distance - METERS_PER_DEGREE) < 0.01, `got ${distance}`);
});

test("distanceInMeters is 0 for the same point", () => {
  assert.equal(distanceInMeters(brinkleyDrink, brinkleyDrink), 0);
});

test("distanceInMeters is the same in both directions", () => {
  assert.equal(
    distanceInMeters(brinkleyDrink, brinkleySnack),
    distanceInMeters(brinkleySnack, brinkleyDrink)
  );
});

test("distanceInMeters handles short campus distances", () => {
  // The two Brinkley machines are a few meters apart
  const distance = distanceInMeters(brinkleyDrink, brinkleySnack);
  assert.ok(distance > 4 && distance < 6, `got ${distance}`);
});

test("calculateDistances returns an empty Map without a user location", () => {
  const machines = [{ ID: 1, GPS: "36.305545, -82.371430" }];
  assert.equal(calculateDistances(null, machines).size, 0);
});

test("calculateDistances keys by string ID and stores null for machines without GPS", () => {
  const user = { lat: brinkleyDrink[0], lng: brinkleyDrink[1] };
  const machines = [
    { ID: 1, GPS: "36.305545, -82.371430" },
    { ID: 3, GPS: "" }
  ];

  const distances = calculateDistances(user, machines);

  assert.equal(distances.size, 2);
  assert.equal(distances.get("1"), 0);
  assert.equal(distances.get("3"), null);
});

test("formatDistance shows feet for short imperial distances", () => {
  assert.equal(formatDistance(0, "imperial"), "0 ft");
  assert.equal(formatDistance(5, "imperial"), "16 ft");
  assert.equal(formatDistance(100, "imperial"), "328 ft");
});

test("formatDistance switches to miles at 0.1 mi (528 ft)", () => {
  // 160.8 m = 527.6 ft, which rounds to 528 ft = 0.1 mi
  assert.equal(formatDistance(160.8, "imperial"), "0.1 mi");
  assert.equal(formatDistance(160.6, "imperial"), "527 ft");
  assert.equal(formatDistance(1609.344, "imperial"), "1.0 mi");
  assert.equal(formatDistance(2414, "imperial"), "1.5 mi");
});

test("formatDistance shows meters and kilometers for metric", () => {
  assert.equal(formatDistance(0, "metric"), "0 m");
  assert.equal(formatDistance(120.4, "metric"), "120 m");
  assert.equal(formatDistance(999.4, "metric"), "999 m");
  assert.equal(formatDistance(999.6, "metric"), "1.0 km");
  assert.equal(formatDistance(1234, "metric"), "1.2 km");
});

test("formatDistance reports unavailable for machines without a distance", () => {
  assert.equal(formatDistance(null, "imperial"), "Distance unavailable");
  assert.equal(formatDistance(undefined, "metric"), "Distance unavailable");
  assert.equal(formatDistance(NaN, "imperial"), "Distance unavailable");
});

test("formatDistance rejects an unknown unit", () => {
  assert.throws(() => formatDistance(100, "furlongs"), /Unknown distance unit/);
});
