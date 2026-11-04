import { test, expect } from "@playwright/test";

const SITE = "http://127.0.0.1:4173";
const SENSOR_INTERVAL_MS = 5000;

const MACHINES_CSV = [
  "ID,Building,Type,Availability,GPS,Payment,Directions,Details",
  '1,Brinkley,Snack,Unknown,"36.305545, -82.371430",Card,,',
  '2,Sam Wilson,Drink,Unknown,"36.303000, -82.370000",Cash,,'
].join("\n");

const PRODUCTS = {
  products: [
    { machineId: 2, name: "Water", price: 1, availability: "Available" },
    { machineId: 2, name: "Soda", price: 1.25, availability: "Available" }
  ]
};

/**
 * Loads the page with test data and a controlled clock. A fixed random value of
 * 0.85 makes every sensor tick pick machine 2, report the machine as Available
 * (under its 0.9 chance), and report each product as Unavailable (over its 0.8 chance).
 */
async function openPage(page, products = PRODUCTS) {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
  await page.route("**/vending_machines.csv", (route) => route.fulfill({ body: MACHINES_CSV }));
  await page.route("**/products.json", (route) => route.fulfill({ json: products }));
  await page.addInitScript(() => {
    Math.random = () => 0.85;
  });
  await page.clock.install();
  await page.goto(SITE);
  await expect(page.locator(".machine-card")).toHaveCount(2);
}

function machineCard(page, id) {
  return page.locator(`.machine-card[data-machine-id="${id}"]`);
}

test("a sensor reading updates the machine and product stock on its card", async ({ page }) => {
  // Arrange
  await openPage(page);
  const card = machineCard(page, 2);
  await card.locator(".details-btn").click();
  await expect(card.locator(".status")).toHaveText("Unknown");

  // Act
  await page.clock.runFor(SENSOR_INTERVAL_MS);

  // Assert
  await expect(card.locator(".status")).toHaveText("Available");
  await expect(card.locator(".machine-availability")).toHaveText("Available");
  await expect(card.locator(".product-status")).toHaveText(["Unavailable", "Unavailable"]);
  await expect(machineCard(page, 1).locator(".status")).toHaveText("Unknown");
});

test("a sensor reading keeps the details panel open and keyboard focus in place", async ({ page }) => {
  // Arrange
  await openPage(page);
  const card = machineCard(page, 2);
  const detailsButton = card.locator(".details-btn");
  await detailsButton.click();
  await detailsButton.focus();

  // Act
  await page.clock.runFor(SENSOR_INTERVAL_MS);
  await expect(card.locator(".status")).toHaveText("Available");

  // Assert
  await expect(detailsButton).toHaveAttribute("aria-expanded", "true");
  await expect(card.locator(".details")).toBeVisible();
  await expect(detailsButton).toBeFocused();
});

test("a reading for a filtered-out machine appears when the machine is shown again", async ({ page }) => {
  // Arrange
  await openPage(page);
  await page.locator('#filters button[data-type="Snack"]').click();
  await expect(page.locator(".machine-card")).toHaveCount(1);

  // Act
  await page.clock.runFor(SENSOR_INTERVAL_MS);
  await page.locator('#filters button[data-type="All"]').click();

  // Assert
  await expect(machineCard(page, 2).locator(".status")).toHaveText("Available");
});

test("a sensor reading updates a machine with no recorded products", async ({ page }) => {
  // Arrange
  await openPage(page, { products: [] });
  const card = machineCard(page, 2);

  // Act
  await page.clock.runFor(SENSOR_INTERVAL_MS);

  // Assert
  await expect(card.locator(".status")).toHaveText("Available");
  await expect(card.locator(".product-empty")).toHaveCount(1);
});
