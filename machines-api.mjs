/*
 * Request handlers for the machine API (Task #6, PBI-38).
 *
 *   GET /api/machines                all machines
 *   GET /api/machines?id=3           one machine
 *   GET /api/products                all products
 *   GET /api/products?machineId=3    one machine's products
 *   GET /api/buildings               buildings that have machines
 *
 * Data loading is passed in, so the handlers can be unit tested with mock data.
 * api/_machine-data.mjs wires them to data/vending_machines.csv and data/products.json.
 *
 * loadData(): Promise<{ machines: object[], products: object[] }>
 */

const LOAD_FAILED = "Machine data couldn't be loaded. Please try again later.";
const MACHINE_NOT_FOUND = "No machine has that ID.";

/**
 * Builds a JSON response. no-store matches /api/reports and keeps browsers
 * from showing stale data after the data files change.
 */
function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

/**
 * Reads a query parameter, treating a blank value (e.g. "?id=") as missing.
 *
 * @returns {string|null} The trimmed value, or null if missing or blank.
 */
function queryParam(request, name) {
  const value = new URL(request.url).searchParams.get(name);
  return value?.trim() || null;
}

/**
 * Finds a machine by ID. IDs are compared as strings because the CSV and
 * query parameters are text, while some data may use numbers.
 */
function findMachine(machines, id) {
  return machines.find((machine) => String(machine.ID) === id) || null;
}

/**
 * Groups machines by building, sorted alphabetically by building name.
 * Rows with no building name are skipped.
 *
 * @param {object[]} machines - Machine rows from data/vending_machines.csv.
 * @returns {{name: string, machineCount: number, machineIds: string[]}[]} One entry per building.
 */
export function listBuildings(machines) {
  const byName = new Map();

  machines.forEach((machine) => {
    const name = String(machine.Building ?? "").trim();
    if (!name) return;

    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(String(machine.ID));
  });

  return [...byName.entries()]
    .map(([name, machineIds]) => ({ name, machineCount: machineIds.length, machineIds }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Creates the GET handlers for machines, products, and buildings.
 *
 * @param {{loadData: Function, logError?: Function}} options
 *   loadData resolves to the machine and product data; logError reports load failures.
 * @returns {{getMachines: Function, getProducts: Function, getBuildings: Function}}
 */
export function createMachineHandlers({ loadData, logError = console.error }) {
  /**
   * Loads the data and passes it to handle(), or returns a 500 response if
   * the data files can't be read.
   */
  async function withData(handle) {
    let data;
    try {
      data = await loadData();
    } catch (error) {
      logError("Unable to load machine data:", error);
      return json({ error: LOAD_FAILED }, 500);
    }
    return handle(data);
  }

  /** GET /api/machines, or one machine with ?id= */
  function getMachines(request) {
    return withData(({ machines }) => {
      const id = queryParam(request, "id");
      if (!id) return json({ machines });

      const machine = findMachine(machines, id);
      return machine ? json({ machine }) : json({ error: MACHINE_NOT_FOUND }, 404);
    });
  }

  /** GET /api/products, or one machine's products with ?machineId= */
  function getProducts(request) {
    return withData(({ machines, products }) => {
      const machineId = queryParam(request, "machineId");
      if (!machineId) return json({ products });

      // An unknown machine is an error; a known machine with no products is an empty list
      if (!findMachine(machines, machineId)) return json({ error: MACHINE_NOT_FOUND }, 404);

      return json({ products: products.filter((product) => String(product.machineId) === machineId) });
    });
  }

  /** GET /api/buildings */
  function getBuildings() {
    return withData(({ machines }) => json({ buildings: listBuildings(machines) }));
  }

  return { getMachines, getProducts, getBuildings };
}