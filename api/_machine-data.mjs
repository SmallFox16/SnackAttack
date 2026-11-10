/*
 * Shared data loader for the API functions (Task #6, PBI-38).
 * The machine API is the only place that reads the machine and product data;
 * the pages get it from /api/machines and /api/products.
 * The leading underscore keeps Vercel from turning this file into its own endpoint.
 * data/vending_machines.csv and data/products.json are bundled via vercel.json includeFiles.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseCSV } from "../csv-utils.mjs";
import { createMachineHandlers } from "../machines-api.mjs";

export const DATA_DIR = path.join(process.cwd(), "data");

let dataPromise = null; // Cached so the files are read once per server instance

/**
 * Reads and parses the machine and product data files.
 *
 * @returns {Promise<{machines: object[], products: object[]}>}
 */
export function loadData() {
  dataPromise ??= Promise.all([
    readFile(path.join(DATA_DIR, "vending_machines.csv"), "utf8"),
    readFile(path.join(DATA_DIR, "products.json"), "utf8")
  ])
    .then(([csv, productJson]) => {
      const productData = JSON.parse(productJson);
      return {
        machines: parseCSV(csv),
        products: Array.isArray(productData.products) ? productData.products : []
      };
    })
    .catch((error) => {
      dataPromise = null; // Retry on the next request instead of caching the failure
      throw error;
    });

  return dataPromise;
}

/**
 * Valid machine IDs, used by /api/reports to check submitted reports.
 *
 * @returns {Promise<Set<string>>}
 */
export async function loadMachineIds() {
  const { machines } = await loadData();
  return new Set(machines.map((machine) => String(machine.ID)));
}

export const handlers = createMachineHandlers({ loadData });
