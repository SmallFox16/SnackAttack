import test from "node:test";
import assert from "node:assert/strict";
import { sortMachinesByDistance } from "../sort-utils.mjs";

const machines = [
  { ID: "A", Building: "Alpha" },
  { ID: "B", Building: "Beta" },
  { ID: "C", Building: "Gamma" },
  { ID: "D", Building: "Delta" }
];

test("sorts machines nearest to farthest using calculated distances", () => {
  const distances = new Map([
    ["A", 420],
    ["B", 95],
    ["C", 210],
    ["D", 800]
  ]);

  const result = sortMachinesByDistance(machines, distances);
  assert.deepEqual(result.map((machine) => machine.ID), ["B", "C", "A", "D"]);
});

test("keeps machines with unavailable location data after machines with distances", () => {
  const distances = new Map([
    ["A", 420],
    ["B", null],
    ["C", 210]
    // D deliberately missing
  ]);

  const result = sortMachinesByDistance(machines, distances);
  assert.deepEqual(result.map((machine) => machine.ID), ["C", "A", "B", "D"]);
});

test("preserves original order when no location distances are available", () => {
  const result = sortMachinesByDistance(machines, new Map());
  assert.deepEqual(result.map((machine) => machine.ID), ["A", "B", "C", "D"]);
});

test("does not mutate the original machine list", () => {
  const originalIds = machines.map((machine) => machine.ID);
  sortMachinesByDistance(machines, new Map([["A", 2], ["B", 1]]));
  assert.deepEqual(machines.map((machine) => machine.ID), originalIds);
});
