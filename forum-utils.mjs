/* Report logic for the community reports forum (forum.html). No DOM access, so it can be unit tested. */

/** Allowed report categories: stored key -> display label. */
export const REPORT_CATEGORIES = Object.freeze({
  "out-of-order": "Machine out of order",
  "product-unavailable": "Product unavailable",
  "incorrect-pricing": "Incorrect pricing",
  other: "Other issue"
});

/** Returns the display label for a category key, or null if the key is not allowed. */
export function categoryLabel(category) {
  return Object.hasOwn(REPORT_CATEGORIES, category) ? REPORT_CATEGORIES[category] : null;
}

export function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Accepts only http(s) image URLs or same-site relative paths, so a report
 * cannot inject a javascript: or data: URL into an <img src>.
 */
function safeImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value.trim(), "https://snackattack.invalid/");
    return url.protocol === "https:" || url.protocol === "http:" ? value.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Validates one raw report and returns a clean copy, or null if a required
 * field (machineId, category, description, submittedAt) is missing or invalid.
 */
export function normalizeReport(raw) {
  if (!raw || typeof raw !== "object") return null;

  const machineId = String(raw.machineId ?? "").trim();
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  const submittedAt = new Date(raw.submittedAt);

  if (!machineId || !description) return null;
  if (!categoryLabel(raw.category)) return null;
  if (typeof raw.submittedAt !== "string" || Number.isNaN(submittedAt.getTime())) return null;

  return {
    id: String(raw.id ?? `${machineId}-${submittedAt.getTime()}`),
    machineId,
    category: raw.category,
    description,
    submittedAt: submittedAt.toISOString(),
    imageUrl: safeImageUrl(raw.imageUrl)
  };
}

/**
 * Reads the reports.json payload ({ reports: [...] }), drops invalid reports,
 * and returns the rest newest first. Anything that isn't a reports array gives [].
 */
export function normalizeReports(data) {
  const reports = Array.isArray(data?.reports) ? data.reports : [];

  return reports
    .map(normalizeReport)
    .filter(Boolean)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

/** Keeps reports for one machine ID; "all" (or no ID) keeps every report. */
export function filterReportsByMachine(reports, machineId) {
  if (!machineId || machineId === "all") return reports;
  return reports.filter((report) => report.machineId === String(machineId));
}

/** "Brinkley Drink machine (#1)", or "Machine #7" if the machine isn't in the CSV. */
export function machineLabel(machinesById, machineId) {
  const machine = machinesById.get(String(machineId));
  if (!machine) return `Machine #${machineId}`;
  return `${machine.Building} ${machine.Type} machine (#${machine.ID})`;
}

/** Formats an ISO date for display, e.g. "Nov 3, 2026, 3:05 PM". timeZone is optional (tests pin it). */
export function formatReportDate(isoDate, timeZone) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "Date unknown";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone
  }).format(date);
}
