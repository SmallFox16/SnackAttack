/*
 * Shared data loader for the machine API functions (Task #6, PBI-38).
 * The leading underscore keeps Vercel from turning this file into its own endpoint.
 * vending_machines.csv and products.json are bundled via vercel.json includeFiles.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseCSV } from "../csv-utils.mjs";
import { createMachineHandlers } from "../machines-api.mjs";

let dataPromise = null; // Cached so the files are read once per server instance

/**
 * Reads and parses the machine and product data files.
 *
 * @returns {Promise<{machines: object[], products: object[]}>}
 */
function loadData() {
  dataPromise ??= Promise.all([
    readFile(path.join(process.cwd(), "vending_machines.csv"), "utf8"),
    readFile(path.join(process.cwd(), "products.json"), "utf8")
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

export const handlers = createMachineHandlers({ loadData });