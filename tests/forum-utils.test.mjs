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

const validReport = {
  id: "r1",
  machineId: 1,
  category: "out-of-order",
  description: "  Screen is blank and it won't take cards.  ",
  submittedAt: "2026-11-03T15:05:00Z",
  imageUrl: "https://example.com/photo.jpg"
};

test("REPORT_CATEGORIES has the four story categories and cannot be changed", () => {
  assert.deepEqual(Object.keys(REPORT_CATEGORIES), [
    "out-of-order",
    "product-unavailable",
    "incorrect-pricing",
    "other"
  ]);
  assert.ok(Object.isFrozen(REPORT_CATEGORIES));
});

test("categoryLabel returns the label for allowed keys and null otherwise", () => {
  assert.equal(categoryLabel("incorrect-pricing"), "Incorrect pricing");
  assert.equal(categoryLabel("broken"), null);
  assert.equal(categoryLabel("toString"), null); // inherited Object property is not a category
  assert.equal(categoryLabel(undefined), null);
});

test("normalizeReport keeps a valid report and trims/stringifies its fields", () => {
  const report = normalizeReport(validReport);

  assert.deepEqual(report, {
    id: "r1",
    machineId: "1",
    category: "out-of-order",
    description: "Screen is blank and it won't take cards.",
    submittedAt: "2026-11-03T15:05:00.000Z",
    imageUrl: "https://example.com/photo.jpg"
  });
});

test("normalizeReport rejects reports missing a required field", () => {
  assert.equal(normalizeReport({ ...validReport, machineId: "" }), null);
  assert.equal(normalizeReport({ ...validReport, machineId: undefined }), null);
  assert.equal(normalizeReport({ ...validReport, description: "   " }), null);
  assert.equal(normalizeReport({ ...validReport, description: 42 }), null);
  assert.equal(normalizeReport({ ...validReport, submittedAt: undefined }), null);
});

test("normalizeReport rejects an unknown category and an invalid date", () => {
  assert.equal(normalizeReport({ ...validReport, category: "vandalism" }), null);
  assert.equal(normalizeReport({ ...validReport, submittedAt: "not a date" }), null);
});

test("normalizeReport rejects non-object input", () => {
  assert.equal(normalizeReport(null), null);
  assert.equal(normalizeReport("report"), null);
});

test("normalizeReport drops unsafe or missing image URLs but keeps the report", () => {
  assert.equal(normalizeReport({ ...validReport, imageUrl: "javascript:alert(1)" }).imageUrl, null);
  assert.equal(normalizeReport({ ...validReport, imageUrl: "data:image/png;base64,AAAA" }).imageUrl, null);
  assert.equal(normalizeReport({ ...validReport, imageUrl: undefined }).imageUrl, null);
  assert.equal(normalizeReport({ ...validReport, imageUrl: "uploads/r1.jpg" }).imageUrl, "uploads/r1.jpg");
});

test("normalizeReport builds an id when the report has none", () => {
  const report = normalizeReport({ ...validReport, id: undefined });
  assert.equal(report.id, `1-${Date.parse("2026-11-03T15:05:00Z")}`);
});

test("normalizeReports drops invalid reports and sorts newest first", () => {
  const data = {
    reports: [
      { ...validReport, id: "old", submittedAt: "2026-10-01T12:00:00Z" },
      { ...validReport, id: "bad", category: "nope" },
      { ...validReport, id: "new", submittedAt: "2026-11-02T12:00:00Z" },
      { ...validReport, id: "mid", submittedAt: "2026-10-15T12:00:00Z" }
    ]
  };

  assert.deepEqual(normalizeReports(data).map((report) => report.id), ["new", "mid", "old"]);
});

test("normalizeReports returns an empty list for empty or malformed data", () => {
  assert.deepEqual(normalizeReports({ reports: [] }), []);
  assert.deepEqual(normalizeReports({}), []);
  assert.deepEqual(normalizeReports(null), []);
  assert.deepEqual(normalizeReports({ reports: "oops" }), []);
});

test("filterReportsByMachine keeps one machine's reports, or all for 'all'", () => {
  const reports = [{ machineId: "1" }, { machineId: "2" }, { machineId: "1" }];

  assert.equal(filterReportsByMachine(reports, "all").length, 3);
  assert.equal(filterReportsByMachine(reports, "").length, 3);
  assert.equal(filterReportsByMachine(reports, 1).length, 2);
  assert.deepEqual(filterReportsByMachine(reports, "9"), []);
});

test("machineLabel names a known machine and falls back for an unknown ID", () => {
  const machines = new Map([["1", { ID: "1", Building: "Brinkley", Type: "Drink" }]]);

  assert.equal(machineLabel(machines, 1), "Brinkley Drink machine (#1)");
  assert.equal(machineLabel(machines, "7"), "Machine #7");
});

test("formatReportDate formats a date and handles an invalid one", () => {
  assert.match(formatReportDate("2026-11-03T15:05:00Z", "UTC"), /^Nov 3, 2026, 3:05\sPM$/);
  assert.equal(formatReportDate("garbage"), "Date unknown");
});

test("escapeHTML escapes markup so report text cannot inject HTML", () => {
  assert.equal(
    escapeHTML(`<img src=x onerror="alert('x')">&`),
    "&lt;img src=x onerror=&quot;alert(&#039;x&#039;)&quot;&gt;&amp;"
  );
  assert.equal(escapeHTML(null), "");
});
