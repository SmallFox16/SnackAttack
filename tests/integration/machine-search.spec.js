import { test, expect } from "@playwright/test";

const SITE = "http://127.0.0.1:4173";

// Shaped like the GET /api/machines and GET /api/products responses
const MACHINES = [
  { ID: "1", Building: "Brinkley", Type: "Drink", Availability: "Unknown", GPS: "36.305545, -82.371430", Payment: "Card", Directions: "", Details: "" },
  { ID: "2", Building: "Sam Wilson", Type: "Snack", Availability: "Unknown", GPS: "36.303000, -82.370000", Payment: "Cash", Directions: "", Details: "" }
];

test.beforeEach(async ({ page }) => {
  // Map tiles come from a live service, so block them to keep tests repeatable
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
});

test("searching by building narrows the machines loaded from the API", async ({ page }) => {
  // Arrange
  await page.route("**/api/machines", (route) => route.fulfill({ json: { machines: MACHINES } }));
  await page.route("**/api/products", (route) => route.fulfill({ json: { products: [] } }));
  await page.goto(SITE);
  await expect(page.locator(".machine-card")).toHaveCount(2);

  // Act
  await page.locator("#search").fill("Brinkley");

  // Assert
  await expect(page.locator(".machine-card")).toHaveCount(1);
  await expect(page.locator("#summary")).toHaveText("1 of 2 machines shown");
});

test("an error message appears when the machine data fails to load", async ({ page }) => {
  // Arrange
  await page.route("**/api/machines", (route) => route.fulfill({ status: 500, json: { error: "Machine data couldn't be loaded." } }));
  await page.route("**/api/products", (route) => route.fulfill({ json: { products: [] } }));

  // Act
  await page.goto(SITE);

  // Assert
  await expect(page.locator(".error-state")).toBeVisible();
  await expect(page.locator("#summary")).toHaveText("Unable to load data");
});
