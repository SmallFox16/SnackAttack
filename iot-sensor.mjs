/* Simulated IoT sensor for SnackAttack (Task #4).
 * Defines the IoT message format, validates incoming messages, and simulates
 * vending machine sensors. Kept separate from app.js so it can be unit tested.
 * Full format description: docs/iot-message-format.md
 */

/**
 * IoT message format sent by each vending machine's sensor.
 *
 * @typedef {object} IoTMessage
 * @property {string} messageId - Unique ID for this message.
 * @property {string} deviceId - ID of the sensor that sent it (e.g. "sensor-3").
 * @property {string} machineId - Matches the ID column in vending_machines.csv.
 * @property {string} timestamp - When the reading was taken, ISO 8601 in UTC.
 * @property {"Available"|"Unavailable"} machineStatus - Whether the machine is working.
 * @property {{name: string, availability: "Available"|"Unavailable"}[]} products
 *   Stock status of each product in the machine.
 */

export const SENSOR_INTERVAL_MS = 5000; // How often the simulated sensor sends a message
export const STATUS_VALUES = ["Available", "Unavailable"]; // Same values the cards already use

let messageCount = 0; // Counter used to make each messageId unique

/**
 * Returns "Available" or "Unavailable" at random.
 *
 * @param {number} availableChance - Probability (0 to 1) of returning "Available".
 * @param {() => number} [random=Math.random] - Random number source (replaceable in tests).
 * @returns {"Available"|"Unavailable"} The random status.
 */
export function randomStatus(availableChance, random = Math.random) {
  return random() < availableChance ? "Available" : "Unavailable";
}

/**
 * Builds one simulated sensor reading for a machine in the IoTMessage format.
 * Machines are usually working (90%) and products are usually in stock (80%).
 *
 * @param {object} machine - A machine row from vending_machines.csv.
 * @param {object[]} [products=[]] - The machine's products from products.json.
 * @param {{random?: () => number, now?: Date}} [options] - Random source and
 *   current time (replaceable in tests).
 * @returns {IoTMessage} A new simulated message.
 */
export function createSensorMessage(machine, products = [], { random = Math.random, now = new Date() } = {}) {
  const machineId = String(machine.ID);

  messageCount += 1;

  return {
    messageId: `msg-${now.getTime()}-${messageCount}`,
    deviceId: `sensor-${machineId}`,
    machineId,
    timestamp: now.toISOString(),
    machineStatus: randomStatus(0.9, random),
    products: products.map((product) => ({
      name: product.name,
      availability: randomStatus(0.8, random)
    }))
  };
}

/**
 * Checks that a message matches the IoTMessage format before it's used.
 * Protects the app from malformed data once real sensors replace the simulation.
 *
 * @param {object} message - The message to check.
 * @returns {boolean} True if every required field exists with a valid value.
 */
export function isValidIoTMessage(message) {
  return Boolean(message)
    && typeof message.messageId === "string"
    && typeof message.deviceId === "string"
    && typeof message.machineId === "string"
    && !Number.isNaN(Date.parse(message.timestamp)) // Must be a real date
    && STATUS_VALUES.includes(message.machineStatus)
    && Array.isArray(message.products)
    && message.products.every((product) => typeof product.name === "string"
      && STATUS_VALUES.includes(product.availability));
}

/**
 * Validates a sensor message and stores it as the latest reading for its machine.
 * Newer messages replace older ones, so the Map always holds the latest reading.
 *
 * @param {Map<string, IoTMessage>} messages - Where messages are stored (state.sensorMessages).
 * @param {IoTMessage} message - The incoming sensor message.
 * @param {Function} [warn=console.warn] - Where to report invalid messages.
 * @returns {boolean} True if the message was stored, false if it was rejected.
 */
export function storeSensorMessage(messages, message, warn = console.warn) {
  // Skip anything that doesn't match the format instead of storing bad data
  if (!isValidIoTMessage(message)) {
    warn("Ignored invalid IoT message:", message);
    return false;
  }

  messages.set(message.machineId, message);
  return true;
}

/**
 * Updates a machine's availability and its products' stock from a validated
 * sensor message. Products the message doesn't mention keep their last known
 * value, and products the machine doesn't list are ignored.
 *
 * @param {object[]} machines - Machine rows (state.machines); updated in place.
 * @param {Map<string, object[]>} productsByMachine - Products for each machine ID; updated in place.
 * @param {IoTMessage} message - A message that has passed isValidIoTMessage.
 * @returns {object|null} The machine if anything changed, otherwise null.
 */
export function applySensorMessage(machines, productsByMachine, message) {
  const machine = machines.find((candidate) => String(candidate.ID) === message.machineId);

  // A sensor can report on a machine that isn't in vending_machines.csv
  if (!machine) return null;

  let changed = machine.Availability !== message.machineStatus;
  machine.Availability = message.machineStatus;

  const readings = new Map(message.products.map((product) => [product.name, product.availability]));
  const products = productsByMachine.get(message.machineId) || [];

  products.forEach((product) => {
    const availability = readings.get(product.name);
    if (!availability || availability === product.availability) return;

    product.availability = availability;
    changed = true;
  });

  return changed ? machine : null;
}

/**
 * Starts the simulated sensor. Every intervalMs it picks a random machine,
 * creates a reading for it, and passes the message to onMessage.
 *
 * @param {object[]} machines - Machine rows to report on.
 * @param {Map<string, object[]>} productsByMachine - Products for each machine ID.
 * @param {(message: IoTMessage) => void} onMessage - Called with each new message.
 * @param {{schedule?: Function, random?: () => number, intervalMs?: number}} [options]
 *   Timer function, random source, and interval (replaceable in tests).
 * @returns {number|null} The interval ID, or null if there were no machines to report on.
 */
export function startSimulatedSensor(machines, productsByMachine, onMessage, {
  schedule = setInterval,
  random = Math.random,
  intervalMs = SENSOR_INTERVAL_MS
} = {}) {
  // Nothing to simulate until machines have loaded
  if (!machines.length) return null;

  return schedule(() => {
    // Pick a random machine to report on, like one sensor checking in at a time
    const machine = machines[Math.floor(random() * machines.length)];
    const products = productsByMachine.get(String(machine.ID)) || [];
    onMessage(createSensorMessage(machine, products, { random }));
  }, intervalMs);
}