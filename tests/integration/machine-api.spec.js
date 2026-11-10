import { test, expect } from "@playwright/test";

/*
 * Integration tests for loading machine data from the machine API.
 * These use the real API and data/ files on purpose: they check that the pages
 * and the API connect. Counts come from the API, so editing the data doesn't break them.
 */

const SITE = "http://127.0.0.1:4173";

test.beforeEach(async ({ page }) => {
  // Map tiles come from a live service, so block them to keep tests repeatable
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
});

test("the machine finder shows every machine from GET /api/machines", async ({ page, request }) => {
  // Arrange
  const { machines } = await (await request.get(`${SITE}/api/machines`)).json();

  // Act
  await page.goto(SITE);

  // Assert
  await expect(page.locator(".machine-card")).toHaveCount(machines.length);
  await expect(page.locator(`.machine-card[data-machine-id="${machines[0].ID}"] h2`)).toHaveText(machines[0].Building);
});

test("a machine's details list its products from GET /api/products", async ({ page, request }) => {
  // Arrange
  const { products } = await (await request.get(`${SITE}/api/products`)).json();
  const machineId = String(products[0].machineId);
  const expectedNames = products.filter((product) => String(product.machineId) === machineId).map((product) => product.name);
  await page.goto(SITE);
  const card = page.locator(`.machine-card[data-machine-id="${machineId}"]`);

  // Assert
  await expect(card.locator(".product-name")).toHaveText(expectedNames);
});

test("the forum's machine list comes from GET /api/machines", async ({ page, request }) => {
  // Arrange
  const { machines } = await (await request.get(`${SITE}/api/machines`)).json();

  // Act
  await page.goto(`${SITE}/forum.html`);

  // Assert: one option per machine, plus the "choose a machine" placeholder
  await expect(page.locator("#reportMachine option")).toHaveCount(machines.length + 1);
});

test("the forum shows an error and disables submitting when GET /api/machines fails", async ({ page }) => {
  // Arrange
  await page.route("**/api/machines", (route) => route.fulfill({ status: 500, json: { error: "Machine data couldn't be loaded." } }));

  // Act
  await page.goto(`${SITE}/forum.html`);

  // Assert
  await expect(page.locator("#reportList .error-state")).toBeVisible();
  await expect(page.locator("#reportSummary")).toHaveText("Unable to load machines");
  await expect(page.locator("#reportSubmit")).toBeDisabled();
});

test("the old data file URLs are gone, so nothing can load a stale copy", async ({ request }) => {
  // Act
  const machines = await request.get(`${SITE}/vending_machines.csv`);
  const products = await request.get(`${SITE}/products.json`);

  // Assert
  expect(machines.status()).toBe(404);
  expect(products.status()).toBe(404);
});
