import test from "node:test";
import assert from "node:assert/strict";
import {
  REPORT_CATEGORIES,
  categoryLabel,
  escapeHTML,
  filterReportsByMachine,
  formatReportDate,
  machineLabel,
  normalizeReport,
  normalizeReports
} from "../forum-utils.mjs";

// Mock report shared by the normalizeReport tests; each test overrides one field.
const validReport = {
  id: "r1",
  machineId: 1,
  category: "out-of-order",
  description: "  Screen is blank and it won't take cards.  ",
  submittedAt: "2026-11-03T15:05:00Z",
  imageUrl: "https://example.com/photo.jpg"
};

/* ---- REPORT_CATEGORIES ---- */

test("REPORT_CATEGORIES lists the four categories from the user story", () => {
  // Act
  const keys = Object.keys(REPORT_CATEGORIES);

  // Assert
  assert.deepEqual(keys, ["out-of-order", "product-unavailable", "incorrect-pricing", "other"]);
});

test("REPORT_CATEGORIES cannot be changed at runtime", () => {
  // Act
  const frozen = Object.isFrozen(REPORT_CATEGORIES);

  // Assert
  assert.equal(frozen, true);
});

/* ---- categoryLabel ---- */

test("categoryLabel returns the display label for an allowed category", () => {
  // Act
  const label = categoryLabel("incorrect-pricing");

  // Assert
  assert.equal(label, "Incorrect pricing");
});

test("categoryLabel returns null for an unknown or missing category", () => {
  // Act
  const unknown = categoryLabel("broken");
  const missing = categoryLabel(undefined);

  // Assert
  assert.equal(unknown, null);
  assert.equal(missing, null);
});

test("categoryLabel does not treat inherited object properties as categories", () => {
  // Act
  const label = categoryLabel("toString");

  // Assert
  assert.equal(label, null);
});

/* ---- normalizeReport ---- */

test("normalizeReport keeps a valid report and cleans up its fields", () => {
  // Act
  const report = normalizeReport(validReport);

  // Assert
  assert.deepEqual(report, {
    id: "r1",
    machineId: "1",
    category: "out-of-order",
    description: "Screen is blank and it won't take cards.",
    submittedAt: "2026-11-03T15:05:00.000Z",
    imageUrl: "https://example.com/photo.jpg"
  });
});

test("normalizeReport rejects a report without a machine ID", () => {
  // Arrange
  const blankId = { ...validReport, machineId: "" };
  const missingId = { ...validReport, machineId: undefined };

  // Act / Assert
  assert.equal(normalizeReport(blankId), null);
  assert.equal(normalizeReport(missingId), null);
});

test("normalizeReport rejects a blank or non-text description", () => {
  // Arrange
  const whitespace = { ...validReport, description: "   " };
  const notText = { ...validReport, description: 42 };

  // Act / Assert
  assert.equal(normalizeReport(whitespace), null);
  assert.equal(normalizeReport(notText), null);
});

test("normalizeReport rejects a category that is not in REPORT_CATEGORIES", () => {
  // Arrange
  const raw = { ...validReport, category: "vandalism" };

  // Act
  const report = normalizeReport(raw);

  // Assert
  assert.equal(report, null);
});

test("normalizeReport rejects a missing or unparseable submission date", () => {
  // Arrange
  const missingDate = { ...validReport, submittedAt: undefined };
  const badDate = { ...validReport, submittedAt: "not a date" };

  // Act / Assert
  assert.equal(normalizeReport(missingDate), null);
  assert.equal(normalizeReport(badDate), null);
});

test("normalizeReport rejects input that is not an object", () => {
  // Act / Assert
  assert.equal(normalizeReport(null), null);
  assert.equal(normalizeReport("report"), null);
});

test("normalizeReport drops javascript: and data: image URLs but keeps the report", () => {
  // Arrange
  const scriptUrl = { ...validReport, imageUrl: "javascript:alert(1)" };
  const dataUrl = { ...validReport, imageUrl: "data:image/png;base64,AAAA" };

  // Act
  const fromScriptUrl = normalizeReport(scriptUrl);
  const fromDataUrl = normalizeReport(dataUrl);

  // Assert
  assert.equal(fromScriptUrl.imageUrl, null);
  assert.equal(fromDataUrl.imageUrl, null);
  assert.equal(fromScriptUrl.description, "Screen is blank and it won't take cards.");
});

test("normalizeReport keeps a relative image path", () => {
  // Arrange
  const raw = { ...validReport, imageUrl: "uploads/r1.jpg" };

  // Act
  const report = normalizeReport(raw);

  // Assert
  assert.equal(report.imageUrl, "uploads/r1.jpg");
});

test("normalizeReport sets imageUrl to null when the report has no image", () => {
  // Arrange
  const raw = { ...validReport, imageUrl: undefined };

  // Act
  const report = normalizeReport(raw);

  // Assert
  assert.equal(report.imageUrl, null);
});

test("normalizeReport builds an ID from machine and timestamp when the report has none", () => {
  // Arrange
  const raw = { ...validReport, id: undefined };

  // Act
  const report = normalizeReport(raw);

  // Assert
  assert.equal(report.id, `1-${Date.parse("2026-11-03T15:05:00Z")}`);
});

/* ---- normalizeReports ---- */

test("normalizeReports sorts reports newest first", () => {
  // Arrange
  const data = {
    reports: [
      { ...validReport, id: "old", submittedAt: "2026-10-01T12:00:00Z" },
      { ...validReport, id: "new", submittedAt: "2026-11-02T12:00:00Z" },
      { ...validReport, id: "mid", submittedAt: "2026-10-15T12:00:00Z" }
    ]
  };

  // Act
  const ids = normalizeReports(data).map((report) => report.id);

  // Assert
  assert.deepEqual(ids, ["new", "mid", "old"]);
});

test("normalizeReports leaves out invalid reports", () => {
  // Arrange
  const data = {
    reports: [
      { ...validReport, id: "good" },
      { ...validReport, id: "bad", category: "nope" }
    ]
  };

  // Act
  const ids = normalizeReports(data).map((report) => report.id);

  // Assert
  assert.deepEqual(ids, ["good"]);
});

test("normalizeReports keeps the original order for reports with the same date", () => {
  // Arrange
  const sameTime = "2026-11-01T08:00:00Z";
  const data = {
    reports: [
      { ...validReport, id: "first", submittedAt: sameTime },
      { ...validReport, id: "second", submittedAt: sameTime }
    ]
  };

  // Act
  const ids = normalizeReports(data).map((report) => report.id);

  // Assert
  assert.deepEqual(ids, ["first", "second"]);
});

test("normalizeReports returns an empty list when there are no reports", () => {
  // Act
  const reports = normalizeReports({ reports: [] });

  // Assert
  assert.deepEqual(reports, []);
});

test("normalizeReports returns an empty list for malformed data", () => {
  // Act / Assert
  assert.deepEqual(normalizeReports({}), []);
  assert.deepEqual(normalizeReports(null), []);
  assert.deepEqual(normalizeReports({ reports: "oops" }), []);
});

/* ---- filterReportsByMachine ---- */

// Mock reports for the filter tests
const machineReports = [{ machineId: "1" }, { machineId: "2" }, { machineId: "1" }];

test("filterReportsByMachine keeps only the selected machine's reports", () => {
  // Act
  const result = filterReportsByMachine(machineReports, "1");

  // Assert
  assert.deepEqual(result, [{ machineId: "1" }, { machineId: "1" }]);
});

test("filterReportsByMachine matches a numeric machine ID against string IDs", () => {
  // Act
  const result = filterReportsByMachine(machineReports, 2);

  // Assert
  assert.deepEqual(result, [{ machineId: "2" }]);
});

test("filterReportsByMachine keeps every report for 'all' or a blank selection", () => {
  // Act
  const all = filterReportsByMachine(machineReports, "all");
  const blank = filterReportsByMachine(machineReports, "");

  // Assert
  assert.equal(all.length, 3);
  assert.equal(blank.length, 3);
});

test("filterReportsByMachine returns an empty list for a machine with no reports", () => {
  // Act
  const result = filterReportsByMachine(machineReports, "9");

  // Assert
  assert.deepEqual(result, []);
});

/* ---- machineLabel ---- */

// Mock machine lookup, shaped like rows parsed from vending_machines.csv
const machinesById = new Map([["1", { ID: "1", Building: "Brinkley", Type: "Drink" }]]);

test("machineLabel names a machine found in the machine data", () => {
  // Act
  const label = machineLabel(machinesById, 1);

  // Assert
  assert.equal(label, "Brinkley Drink machine (#1)");
});

test("machineLabel falls back to the machine number for an unknown ID", () => {
  // Act
  const label = machineLabel(machinesById, "7");

  // Assert
  assert.equal(label, "Machine #7");
});

/* ---- formatReportDate ---- */

test("formatReportDate shows the date and time in a readable format", () => {
  // Act (time zone pinned so the result is the same on every machine)
  const text = formatReportDate("2026-11-03T15:05:00Z", "UTC");

  // Assert (\s allows the narrow no-break space some Node versions put before PM)
  assert.match(text, /^Nov 3, 2026, 3:05\sPM$/);
});

test("formatReportDate returns 'Date unknown' for an invalid date", () => {
  // Act
  const text = formatReportDate("garbage");

  // Assert
  assert.equal(text, "Date unknown");
});

/* ---- escapeHTML ---- */

test("escapeHTML escapes markup so report text cannot inject HTML", () => {
  // Arrange
  const input = `<img src=x onerror="alert('x')">&`;

  // Act
  const escaped = escapeHTML(input);

  // Assert
  assert.equal(escaped, "&lt;img src=x onerror=&quot;alert(&#039;x&#039;)&quot;&gt;&amp;");
});

test("escapeHTML returns an empty string for null", () => {
  // Act
  const escaped = escapeHTML(null);

  // Assert
  assert.equal(escaped, "");
});
