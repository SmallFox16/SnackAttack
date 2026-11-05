import { test, expect } from "@playwright/test";

const SITE = "http://127.0.0.1:4173";

const MACHINES_CSV = [
  "ID,Building,Type,Availability,GPS,Payment,Directions,Details",
  '1,Brinkley,Drink,Unknown,"36.305545, -82.371430",Card,,',
  '2,Sam Wilson,Snack,Unknown,"36.303000, -82.370000",Cash,,'
].join("\n");

test.beforeEach(async ({ page }) => {
  // Map tiles come from a live service, so block them to keep tests repeatable
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
});

test("searching by building narrows the machines loaded from the CSV", async ({ page }) => {
  // Arrange
  await page.route("**/vending_machines.csv", (route) => route.fulfill({ body: MACHINES_CSV }));
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
  await page.route("**/vending_machines.csv", (route) => route.fulfill({ status: 500 }));

  // Act
  await page.goto(SITE);

  // Assert
  await expect(page.locator(".error-state")).toBeVisible();
  await expect(page.locator("#summary")).toHaveText("Unable to load data");
});
