# Integration Testing Standard

## Purpose
Establish one procedure for checking that new code works with the rest of SnackAttack. Unit tests show that a function is correct on its own. Integration tests show that the pieces work together in a real browser: data loads, modules connect, and the page updates.

This standard applies to all new code. It works alongside the [unit testing standard](unit-test-standard.md) and does not replace it.

## 1. When an Integration Test Is Required

Add or update an integration test when a change affects how parts of the application connect, including:

- **Data to page:** Loading or displaying `vending_machines.csv`, `products.json`, or `reports.json`.
- **Module to page:** Connecting logic from a tested file (such as `iot-sensor.mjs`) to `app.js` or `forum.js`.
- **User action to result:** Search, filters, sorting, buttons, and expandable details.
- **Page to page:** Navigation or data shared between `index.html` and `forum.html`.
- **Browser features and libraries:** Geolocation, timers, and our code that uses the Leaflet map.

An integration test is not required for:

- Changes to a function's internal logic that do not change how it connects to anything. These need unit tests.
- Documentation and static content.
- Styling that does not change behavior.

If a change is exempt, say why in the pull request.

## 2. Procedure

Follow these steps for every change that section 1 applies to.

1. **List the connections.** Write down what the new code receives, what it passes on, and what the user sees as a result.
2. **Choose the scenarios.** Use section 3 to decide what to test.
3. **Write the tests.** Add them to `tests/integration/`, following sections 4 and 5.
4. **Run the new tests.** Use the commands in section 6 and fix any failures.
5. **Check for regressions.** Run the whole integration suite, the accessibility tests, and `npm run quality`.
6. **Record the result.** Complete the pull request checklist in section 7.

## 3. Choosing Scenarios

Each integration test should follow one complete path through the application. Consider:

- **Normal flow:** The user completes the task with valid data.
- **Failed dependency:** A data file is missing, or a browser feature is denied.
- **Empty or partial data:** A file loads but has no rows, or some fields are blank.
- **Interaction between features:** The new code still works alongside existing features, such as filters and open details panels.
- **Preserved page state:** Updates do not close panels, close map popups, or move keyboard focus.

Every new connection needs at least one normal flow and one failure or edge scenario. Do not repeat every unit test case in the browser. Leave detailed input checks to unit tests.

## 4. Test Structure

Integration tests use Playwright, which is already installed for the accessibility tests.

- Store tests in `tests/integration/`.
- Name each file after the feature it covers, ending in `.spec.js` (for example, `machine-search.spec.js`). Do not use `.test.js`, because `npm test` would try to run the file with `node:test`.
- Follow the Arrange-Act-Assert pattern, with one user flow per test and a descriptive name.

Example, from `tests/integration/machine-search.spec.js`:

```js
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
```

## 5. Testing Guidelines

- **Use the real application.** Load the real pages and scripts. Replace only what the test cannot control.
- **Use test data.** Supply data with `page.route()` so that editing the real CSV or JSON files does not break tests.
- **Keep tests repeatable.** Results must not depend on the time, random values, or test order.
- **Control timers.** Use `page.clock` to move time forward instead of waiting. For example, the simulated sensor reports every 5 seconds.
- **Control random values.** Replace `Math.random` with `page.addInitScript()` when the result depends on it, as simulated sensor readings do.
- **Mock browser permissions.** Use Playwright's `geolocation` and `permissions` options instead of a real location.
- **Wait for results, not time.** Use `expect(...)` checks, which retry automatically. Do not use fixed delays such as `page.waitForTimeout()`.
- **Test what the user sees.** Check page content and state. Do not test Leaflet's internal behavior.
- **Keep tests independent.** Each test sets up its own data and must pass when run alone.

## 6. Running the Tests

Install the dependencies and the browser once:

```bash
npm install
npx playwright install chromium
```

Start the website in one terminal.

macOS or Linux:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Windows:

```powershell
python -c "import http.server as s; s.SimpleHTTPRequestHandler.extensions_map['.mjs'] = 'text/javascript'; s.test(s.SimpleHTTPRequestHandler, port=4173, bind='127.0.0.1')"
```

Use the longer command on Windows because the usual one can send `.mjs` files as plain text. The browser then refuses to run them, and the pages never load their data.

Run the tests in a second terminal:

```bash
npx playwright test tests/integration
npx playwright test tests/accessibility.spec.js
npm run quality
```

To run a single test file:

```bash
npx playwright test tests/integration/machine-search.spec.js
```

## 7. Pull Request Checklist

Copy this checklist into the description of every pull request with new code:

```markdown
### Integration testing
- [ ] Integration tests added or updated, or the reason this change is exempt: ___
- [ ] Each new connection has a normal flow and a failure or edge scenario
- [ ] `npx playwright test tests/integration` passes
- [ ] `npx playwright test tests/accessibility.spec.js` passes
- [ ] `npm run quality` passes
```

GitHub Actions also runs the integration tests on every push and pull request (`.github/workflows/accessibility.yml`). Run them locally first so that failures are found before they reach the team.

A pull request should not be merged while an integration test is failing. Do not skip or delete a failing test to get a change merged. If a test has to be disabled, link to an open issue that explains why.

## 8. Current Limitations

- **Tests need internet access.** The pages load Leaflet from a CDN, and `app.js` cannot start without it.
- **Only Chromium is covered.** Use the [manual mobile checklist](testing.md#manual-test-checklist-mobile) for phones and other browsers.
