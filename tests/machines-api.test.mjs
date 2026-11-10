import test from "node:test";
import assert from "node:assert/strict";
import { createMachineHandlers, listBuildings } from "../machines-api.mjs";

/* Unit tests for the machine API handlers (Task #6, PBI-38). */

// Mock data shaped like vending_machines.csv rows and products.json entries
const MACHINES = [
  { ID: "1", Building: "Brinkley", Type: "Drink" },
  { ID: "2", Building: "Brinkley", Type: "Snack" },
  { ID: "7", Building: "Sam-Wilson", Type: "Drink" },
  { ID: "4", Building: "Culp Center", Type: "Personal Care" }
];

const PRODUCTS = [
  { machineId: "1", name: "Gatorade", price: 2.5, availability: "Available" },
  { machineId: 1, name: "Water", price: 1.75, availability: "Unavailable" }, // numeric ID on purpose
  { machineId: "2", name: "Trail Mix", price: 1.5, availability: "Available" }
];

/** Creates handlers backed by mock data, or by a loader that fails. */
function createHandlers({ machines = MACHINES, products = PRODUCTS, fail = false } = {}) {
  return createMachineHandlers({
    loadData: async () => {
      if (fail) throw new Error("file missing");
      return { machines, products };
    },
    logError: () => {} // keep expected failures out of the test output
  });
}

/** Builds a GET request for an API path. */
function request(pathAndQuery) {
  return new Request(`http://localhost${pathAndQuery}`);
}

/* ---- GET /api/machines ---- */

test("getMachines returns every machine in a machines array", async () => {
  // Arrange
  const { getMachines } = createHandlers();

  // Act
  const response = await getMachines(request("/api/machines"));

  // Assert
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { machines: MACHINES });
});

test("getMachines tells browsers not to cache the response", async () => {
  // Arrange
  const { getMachines } = createHandlers();

  // Act
  const response = await getMachines(request("/api/machines"));

  // Assert
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("getMachines returns one machine when an id is given", async () => {
  // Arrange
  const { getMachines } = createHandlers();

  // Act
  const response = await getMachines(request("/api/machines?id=7"));

  // Assert
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { machine: MACHINES[2] });
});

test("getMachines matches a numeric machine ID in the data", async () => {
  // Arrange
  const { getMachines } = createHandlers({ machines: [{ ID: 5, Building: "Ball" }] });

  // Act
  const response = await getMachines(request("/api/machines?id=5"));

  // Assert
  assert.equal((await response.json()).machine.Building, "Ball");
});

test("getMachines returns 404 for an unknown machine id", async () => {
  // Arrange
  const { getMachines } = createHandlers();

  // Act
  const response = await getMachines(request("/api/machines?id=42"));

  // Assert
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "No machine has that ID.");
});

test("getMachines treats a blank id as no id and returns every machine", async () => {
  // Arrange
  const { getMachines } = createHandlers();

  // Act
  const response = await getMachines(request("/api/machines?id=%20"));

  // Assert
  assert.equal((await response.json()).machines.length, MACHINES.length);
});

test("getMachines returns an empty list when there are no machines", async () => {
  // Arrange
  const { getMachines } = createHandlers({ machines: [] });

  // Act
  const response = await getMachines(request("/api/machines"));

  // Assert
  assert.deepEqual(await response.json(), { machines: [] });
});

test("getMachines returns 500 when the data can't be loaded", async () => {
  // Arrange
  const { getMachines } = createHandlers({ fail: true });

  // Act
  const response = await getMachines(request("/api/machines"));

  // Assert
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /couldn't be loaded/);
});

/* ---- GET /api/products ---- */

test("getProducts returns every product in a products array", async () => {
  // Arrange
  const { getProducts } = createHandlers();

  // Act
  const response = await getProducts(request("/api/products"));

  // Assert
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { products: PRODUCTS });
});

test("getProducts returns only the given machine's products, including numeric IDs", async () => {
  // Arrange
  const { getProducts } = createHandlers();

  // Act
  const response = await getProducts(request("/api/products?machineId=1"));

  // Assert
  const names = (await response.json()).products.map((product) => product.name);
  assert.deepEqual(names, ["Gatorade", "Water"]);
});

test("getProducts returns an empty list for a known machine with no products", async () => {
  // Arrange
  const { getProducts } = createHandlers();

  // Act
  const response = await getProducts(request("/api/products?machineId=7"));

  // Assert
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { products: [] });
});

test("getProducts returns 404 for an unknown machine id", async () => {
  // Arrange
  const { getProducts } = createHandlers();

  // Act
  const response = await getProducts(request("/api/products?machineId=42"));

  // Assert
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "No machine has that ID.");
});

test("getProducts returns 500 when the data can't be loaded", async () => {
  // Arrange
  const { getProducts } = createHandlers({ fail: true });

  // Act
  const response = await getProducts(request("/api/products"));

  // Assert
  assert.equal(response.status, 500);
});

/* ---- GET /api/buildings ---- */

test("getBuildings groups machines by building, sorted by name", async () => {
  // Arrange
  const { getBuildings } = createHandlers();

  // Act
  const response = await getBuildings(request("/api/buildings"));

  // Assert
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    buildings: [
      { name: "Brinkley", machineCount: 2, machineIds: ["1", "2"] },
      { name: "Culp Center", machineCount: 1, machineIds: ["4"] },
      { name: "Sam-Wilson", machineCount: 1, machineIds: ["7"] }
    ]
  });
});

test("getBuildings returns 500 when the data can't be loaded", async () => {
  // Arrange
  const { getBuildings } = createHandlers({ fail: true });

  // Act
  const response = await getBuildings(request("/api/buildings"));

  // Assert
  assert.equal(response.status, 500);
});

/* ---- listBuildings ---- */

test("listBuildings skips machines with a missing or blank building name", () => {
  // Arrange
  const machines = [
    { ID: "1", Building: "Brinkley" },
    { ID: "2", Building: "   " },
    { ID: "3" }
  ];

  // Act
  const buildings = listBuildings(machines);

  // Assert
  assert.deepEqual(buildings, [{ name: "Brinkley", machineCount: 1, machineIds: ["1"] }]);
});

test("listBuildings trims building names so spacing differences don't split a building", () => {
  // Arrange
  const machines = [
    { ID: "1", Building: "Brinkley" },
    { ID: "2", Building: " Brinkley " }
  ];

  // Act
  const buildings = listBuildings(machines);

  // Assert
  assert.deepEqual(buildings, [{ name: "Brinkley", machineCount: 2, machineIds: ["1", "2"] }]);
});

test("listBuildings returns an empty list when there are no machines", () => {
  assert.deepEqual(listBuildings([]), []);
});