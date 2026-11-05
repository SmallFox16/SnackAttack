import test from "node:test";
import assert from "node:assert/strict";
import {
  SENSOR_INTERVAL_MS,
  randomStatus,
  createSensorMessage,
  isValidIoTMessage,
  storeSensorMessage,
  applySensorMessage,
  startSimulatedSensor
} from "../iot-sensor.mjs";

/* Unit tests for the simulated IoT sensor (Task #4). */

const machines = [
  { ID: "3", Building: "Brinkley" },
  { ID: "7", Building: "Sam Wilson" }
];

const productsByMachine = new Map([
  ["3", [{ name: "Coca-Cola" }, { name: "Sprite" }]]
  // Machine 7 deliberately has no products
]);

/**
 * Builds a message that matches the IoT format, with optional fields overridden.
 */
function validMessage(overrides = {}) {
  return {
    messageId: "msg-1-1",
    deviceId: "sensor-3",
    machineId: "3",
    timestamp: "2026-11-09T15:41:30.745Z",
    machineStatus: "Available",
    products: [{ name: "Coca-Cola", availability: "Available" }],
    ...overrides
  };
}

/**
 * Fake setInterval that records calls instead of running them,
 * so tests decide when the sensor "ticks".
 */
function fakeScheduler() {
  const calls = [];
  const schedule = (callback, ms) => {
    calls.push({ callback, ms });
    return calls.length;
  };
  return { calls, schedule };
}

/* ---- randomStatus ---- */

test("randomStatus returns Available when the random roll is below the chance", () => {
  assert.equal(randomStatus(0.9, () => 0.5), "Available");
});

test("randomStatus returns Unavailable when the random roll is above the chance", () => {
  assert.equal(randomStatus(0.3, () => 0.5), "Unavailable");
});

test("randomStatus returns Unavailable when the roll equals the chance exactly", () => {
  assert.equal(randomStatus(0.9, () => 0.9), "Unavailable");
});

/* ---- createSensorMessage ---- */

test("createSensorMessage builds a message that passes format validation", () => {
  const message = createSensorMessage(machines[0], productsByMachine.get("3"));
  assert.equal(isValidIoTMessage(message), true);
});

test("createSensorMessage fills in the machine and device IDs", () => {
  const message = createSensorMessage(machines[0]);
  assert.equal(message.machineId, "3");
  assert.equal(message.deviceId, "sensor-3");
});

test("createSensorMessage converts a numeric machine ID to a string", () => {
  const message = createSensorMessage({ ID: 5 });
  assert.equal(message.machineId, "5");
});

test("createSensorMessage uses the given time for the timestamp", () => {
  const now = new Date("2026-11-09T15:41:30.745Z");
  const message = createSensorMessage(machines[0], [], { now });
  assert.equal(message.timestamp, "2026-11-09T15:41:30.745Z");
});

test("createSensorMessage reports on every product listed for the machine", () => {
  const message = createSensorMessage(machines[0], productsByMachine.get("3"));
  assert.deepEqual(message.products.map((product) => product.name), ["Coca-Cola", "Sprite"]);
});

test("createSensorMessage uses the random source for machine and product status", () => {
  // 0.85 is under the machine's 0.9 chance but over the product's 0.8 chance
  const message = createSensorMessage(machines[0], productsByMachine.get("3"), { random: () => 0.85 });
  assert.equal(message.machineStatus, "Available");
  assert.deepEqual(message.products.map((product) => product.availability), ["Unavailable", "Unavailable"]);
});

test("createSensorMessage sends an empty product list for a machine with no products", () => {
  const message = createSensorMessage(machines[1]);
  assert.deepEqual(message.products, []);
  assert.equal(isValidIoTMessage(message), true);
});

test("createSensorMessage gives each message a unique messageId", () => {
  const now = new Date();
  const first = createSensorMessage(machines[0], [], { now });
  const second = createSensorMessage(machines[0], [], { now });
  assert.notEqual(first.messageId, second.messageId);
});

/* ---- isValidIoTMessage ---- */

test("isValidIoTMessage accepts a correctly formatted message", () => {
  assert.equal(isValidIoTMessage(validMessage()), true);
});

test("isValidIoTMessage accepts a message with an empty product list", () => {
  assert.equal(isValidIoTMessage(validMessage({ products: [] })), true);
});

// Each entry is one way a message can break the format; all should be rejected
const invalidCases = {
  "null instead of a message": null,
  "a missing messageId": validMessage({ messageId: undefined }),
  "a missing deviceId": validMessage({ deviceId: undefined }),
  "a numeric machineId": validMessage({ machineId: 3 }),
  "an invalid timestamp": validMessage({ timestamp: "not a date" }),
  "an unknown machineStatus": validMessage({ machineStatus: "Broken" }),
  "products that is not an array": validMessage({ products: "Coca-Cola" }),
  "a product with an unknown availability": validMessage({
    products: [{ name: "Sprite", availability: "Maybe" }]
  }),
  "a product missing its name": validMessage({ products: [{ availability: "Available" }] })
};

for (const [label, message] of Object.entries(invalidCases)) {
  test(`isValidIoTMessage rejects ${label}`, () => {
    assert.equal(isValidIoTMessage(message), false);
  });
}

/* ---- storeSensorMessage ---- */

test("storeSensorMessage stores a valid message under its machine ID", () => {
  const messages = new Map();
  assert.equal(storeSensorMessage(messages, validMessage()), true);
  assert.equal(messages.get("3").messageId, "msg-1-1");
});

test("storeSensorMessage keeps only the latest message for each machine", () => {
  const messages = new Map();
  storeSensorMessage(messages, validMessage({ messageId: "msg-1-1" }));
  storeSensorMessage(messages, validMessage({ messageId: "msg-2-2", machineStatus: "Unavailable" }));
  assert.equal(messages.size, 1);
  assert.equal(messages.get("3").messageId, "msg-2-2");
});

test("storeSensorMessage stores messages for different machines separately", () => {
  const messages = new Map();
  storeSensorMessage(messages, validMessage({ machineId: "3" }));
  storeSensorMessage(messages, validMessage({ machineId: "7", deviceId: "sensor-7" }));
  assert.equal(messages.size, 2);
});

test("storeSensorMessage rejects an invalid message and reports a warning", () => {
  const messages = new Map();
  const warnings = [];
  const stored = storeSensorMessage(messages, validMessage({ machineStatus: "Broken" }), (...args) => warnings.push(args));
  assert.equal(stored, false);
  assert.equal(messages.size, 0);
  assert.equal(warnings.length, 1);
});

/* ---- startSimulatedSensor ---- */

test("startSimulatedSensor does not start when there are no machines", () => {
  const { calls, schedule } = fakeScheduler();
  const timer = startSimulatedSensor([], productsByMachine, () => {}, { schedule });
  assert.equal(timer, null);
  assert.equal(calls.length, 0);
});

test("startSimulatedSensor schedules one interval at SENSOR_INTERVAL_MS", () => {
  const { calls, schedule } = fakeScheduler();
  startSimulatedSensor(machines, productsByMachine, () => {}, { schedule });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].ms, SENSOR_INTERVAL_MS);
});

test("each sensor tick sends a valid message for the randomly picked machine", () => {
  const { calls, schedule } = fakeScheduler();
  const received = [];

  // 0.6 * 2 machines rounds down to index 1, so machine 7 is picked
  startSimulatedSensor(machines, productsByMachine, (message) => received.push(message), {
    schedule,
    random: () => 0.6
  });

  calls[0].callback(); // Simulate one interval tick

  assert.equal(received.length, 1);
  assert.equal(received[0].machineId, "7");
  assert.equal(isValidIoTMessage(received[0]), true);
});

test("each sensor tick includes the picked machine's products", () => {
  const { calls, schedule } = fakeScheduler();
  const received = [];

  // 0.1 * 2 machines rounds down to index 0, so machine 3 is picked
  startSimulatedSensor(machines, productsByMachine, (message) => received.push(message), {
    schedule,
    random: () => 0.1
  });

  calls[0].callback();

  assert.deepEqual(received[0].products.map((product) => product.name), ["Coca-Cola", "Sprite"]);
});

/* ---- applySensorMessage ---- */

/**
 * Builds fresh machine and product data, since applySensorMessage updates it in place.
 */
function stockData() {
  return {
    stockMachines: [{ ID: "3", Availability: "Unknown" }, { ID: "7", Availability: "Unknown" }],
    stockProducts: new Map([
      ["3", [
        { name: "Coca-Cola", price: 1.5, availability: "Available" },
        { name: "Sprite", price: 1.5, availability: "Available" }
      ]]
    ])
  };
}

test("applySensorMessage updates the machine's availability", () => {
  // Arrange
  const { stockMachines, stockProducts } = stockData();

  // Act
  applySensorMessage(stockMachines, stockProducts, validMessage({ machineStatus: "Unavailable" }));

  // Assert
  assert.equal(stockMachines[0].Availability, "Unavailable");
  assert.equal(stockMachines[1].Availability, "Unknown");
});

test("applySensorMessage updates the stock of a reported product", () => {
  // Arrange
  const { stockMachines, stockProducts } = stockData();
  const message = validMessage({ products: [{ name: "Sprite", availability: "Unavailable" }] });

  // Act
  applySensorMessage(stockMachines, stockProducts, message);

  // Assert
  assert.equal(stockProducts.get("3")[1].availability, "Unavailable");
});

test("applySensorMessage keeps the last known stock of products missing from the message", () => {
  // Arrange
  const { stockMachines, stockProducts } = stockData();
  const message = validMessage({ products: [{ name: "Sprite", availability: "Unavailable" }] });

  // Act
  applySensorMessage(stockMachines, stockProducts, message);

  // Assert
  assert.equal(stockProducts.get("3")[0].availability, "Available");
});

test("applySensorMessage leaves a product's other fields unchanged", () => {
  // Arrange
  const { stockMachines, stockProducts } = stockData();
  const message = validMessage({ products: [{ name: "Sprite", availability: "Unavailable" }] });

  // Act
  applySensorMessage(stockMachines, stockProducts, message);

  // Assert
  assert.equal(stockProducts.get("3")[1].price, 1.5);
});

test("applySensorMessage returns the machine when only its status changed", () => {
  // Arrange
  const { stockMachines, stockProducts } = stockData();

  // Act
  const result = applySensorMessage(stockMachines, stockProducts, validMessage({ products: [] }));

  // Assert
  assert.equal(result, stockMachines[0]);
});

test("applySensorMessage returns the machine when only a product changed", () => {
  // Arrange
  const { stockMachines, stockProducts } = stockData();
  stockMachines[0].Availability = "Available";
  const message = validMessage({ products: [{ name: "Sprite", availability: "Unavailable" }] });

  // Act
  const result = applySensorMessage(stockMachines, stockProducts, message);

  // Assert
  assert.equal(result, stockMachines[0]);
});

test("applySensorMessage returns null when the reading matches what is already shown", () => {
  // Arrange
  const { stockMachines, stockProducts } = stockData();
  stockMachines[0].Availability = "Available";

  // Act
  const result = applySensorMessage(stockMachines, stockProducts, validMessage({
    products: [{ name: "Sprite", availability: "Available" }]
  }));

  // Assert
  assert.equal(result, null);
});

test("applySensorMessage ignores a machine that isn't in the machine list", () => {
  // Arrange
  const { stockMachines, stockProducts } = stockData();

  // Act
  const result = applySensorMessage(stockMachines, stockProducts, validMessage({ machineId: "99" }));

  // Assert
  assert.equal(result, null);
  assert.deepEqual(stockMachines, stockData().stockMachines);
});

test("applySensorMessage ignores a product the machine doesn't list", () => {
  // Arrange
  const { stockMachines, stockProducts } = stockData();
  const message = validMessage({ products: [{ name: "Pepsi", availability: "Unavailable" }] });

  // Act
  applySensorMessage(stockMachines, stockProducts, message);

  // Assert
  assert.deepEqual(stockProducts, stockData().stockProducts);
});

test("applySensorMessage handles a machine with no recorded products", () => {
  // Arrange
  const { stockMachines, stockProducts } = stockData();
  const message = validMessage({
    machineId: "7",
    products: [{ name: "Sprite", availability: "Unavailable" }]
  });

  // Act
  const result = applySensorMessage(stockMachines, stockProducts, message);

  // Assert
  assert.equal(result, stockMachines[1]);
  assert.equal(stockProducts.has("7"), false);
});

test("applySensorMessage matches a numeric machine ID from the data", () => {
  // Arrange
  const machine = { ID: 3, Availability: "Unknown" };

  // Act
  const result = applySensorMessage([machine], new Map(), validMessage());

  // Assert
  assert.equal(result, machine);
});
