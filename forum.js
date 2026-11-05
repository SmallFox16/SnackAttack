/*
 * Community reports forum page: lists reports (Task #8) and submits new ones (Task #7).
 * Report logic lives in forum-utils.mjs; submission rules live in report-validation.mjs.
 */
import { parseCSV } from "./csv-utils.mjs";
import {
  REPORT_CATEGORIES,
  categoryLabel,
  escapeHTML,
  filterReportsByMachine,
  formatReportDate,
  machineLabel,
  normalizeReport,
  normalizeReports
} from "./forum-utils.mjs";
import {
  MAX_DESCRIPTION_LENGTH,
  validateImageMeta,
  validateReportFields
} from "./report-validation.mjs";

const REPORTS_API = "/api/reports";

const state = {
  reports: [],
  machinesById: new Map(),
  machineFilter: "all"
};

const reportList = document.getElementById("reportList");
const summary = document.getElementById("reportSummary");
const machineFilter = document.getElementById("machineFilter");

const form = document.getElementById("reportForm");
const formMachine = document.getElementById("reportMachine");
const formCategories = document.getElementById("reportCategories");
const formDescription = document.getElementById("reportDescription");
const formDescriptionCount = document.getElementById("reportDescriptionCount");
const formImage = document.getElementById("reportImage");
const formSubmit = document.getElementById("reportSubmit");
const formStatus = document.getElementById("reportFormStatus");

// Field name -> [element that gets aria-invalid, error message element]
const fieldElements = {
  machineId: [formMachine, document.getElementById("reportMachineError")],
  category: [formCategories.closest("fieldset"), document.getElementById("reportCategoryError")],
  description: [formDescription, document.getElementById("reportDescriptionError")],
  image: [formImage, document.getElementById("reportImageError")]
};

/* ---- Report list ---- */

function reportCard(report) {
  const machine = machineLabel(state.machinesById, report.machineId);
  const image = report.imageUrl
    ? `<img class="report-image" src="${escapeHTML(report.imageUrl)}" alt="Photo submitted with this report for ${escapeHTML(machine)}" loading="lazy" />`
    : "";

  return `
    <article class="report-card" data-machine-id="${escapeHTML(report.machineId)}">
      <div class="report-heading">
        <div>
          <p class="machine-number">Machine #${escapeHTML(report.machineId)}</p>
          <h3>${escapeHTML(machine)}</h3>
        </div>
        <span class="report-category ${escapeHTML(report.category)}">${escapeHTML(categoryLabel(report.category))}</span>
      </div>
      <p class="report-description">${escapeHTML(report.description)}</p>
      ${image}
      <time class="report-date" datetime="${escapeHTML(report.submittedAt)}">Submitted ${escapeHTML(formatReportDate(report.submittedAt))}</time>
    </article>`;
}

function render() {
  const reports = filterReportsByMachine(state.reports, state.machineFilter);
  summary.textContent = `${reports.length} report${reports.length === 1 ? "" : "s"} shown`;

  if (!state.reports.length) {
    reportList.innerHTML = '<div class="empty-state">No reports yet. Be the first to submit one using the form above.</div>';
    return;
  }

  if (!reports.length) {
    reportList.innerHTML = '<div class="empty-state">No reports for this machine yet.</div>';
    return;
  }

  reportList.innerHTML = reports.map(reportCard).join("");
}

function machineOptions() {
  return [...state.machinesById.values()].map((machine) =>
    `<option value="${escapeHTML(machine.ID)}">${escapeHTML(machineLabel(state.machinesById, machine.ID))}</option>`
  ).join("");
}

/* ---- Submit form ---- */

function renderCategoryOptions() {
  formCategories.innerHTML = Object.entries(REPORT_CATEGORIES).map(([value, label]) => `
    <label class="radio-option">
      <input type="radio" name="category" value="${escapeHTML(value)}" />
      ${escapeHTML(label)}
    </label>`).join("");
}

function updateDescriptionCount() {
  formDescriptionCount.textContent = `${formDescription.value.length} / ${MAX_DESCRIPTION_LENGTH} characters`;
}

function setStatus(message, type = "") {
  formStatus.textContent = message;
  formStatus.className = `form-status ${type}`.trim();
}

/** Shows each field's error (or clears it) and focuses the first invalid field. */
function showFieldErrors(errors) {
  let firstInvalid = null;

  Object.entries(fieldElements).forEach(([field, [input, message]]) => {
    const error = errors[field];
    message.textContent = error || "";
    message.hidden = !error;

    if (input.tagName === "FIELDSET") {
      input.dataset.invalid = String(Boolean(error));
    } else {
      input.setAttribute("aria-invalid", String(Boolean(error)));
    }

    if (error && !firstInvalid) {
      firstInvalid = input.tagName === "FIELDSET" ? input.querySelector("input") : input;
    }
  });

  firstInvalid?.focus();
}

/** Runs the same checks the server runs, so most mistakes are caught before upload. */
function validateForm() {
  const data = new FormData(form);
  const { errors } = validateReportFields(
    {
      machineId: data.get("machineId"),
      category: data.get("category"),
      description: data.get("description")
    },
    new Set(state.machinesById.keys())
  );

  const image = formImage.files[0];
  if (image) {
    const imageError = validateImageMeta({ type: image.type, size: image.size });
    if (imageError) errors.image = imageError;
  }

  return errors;
}

async function submitReport(event) {
  event.preventDefault();
  setStatus("");

  const errors = validateForm();
  showFieldErrors(errors);
  if (Object.keys(errors).length) {
    setStatus("Please fix the highlighted fields.", "error");
    return;
  }

  formSubmit.disabled = true;
  setStatus("Submitting your report…");

  try {
    const response = await fetch(REPORTS_API, { method: "POST", body: new FormData(form) });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      showFieldErrors(body.errors || {});
      setStatus(body.error || "Your report couldn't be saved. Please try again.", "error");
      return;
    }

    const report = normalizeReport(body.report);
    if (report) state.reports = [report, ...state.reports];
    render();

    form.reset();
    updateDescriptionCount();
    showFieldErrors({});
    setStatus("Thanks! Your report was submitted and is now listed below.", "success");
  } catch (error) {
    console.error("Unable to submit report:", error);
    setStatus("Your report couldn't be sent. Check your connection and try again.", "error");
  } finally {
    formSubmit.disabled = false;
  }
}

/** Pre-selects the machine from ?machine=<ID> so other pages can link straight to a report. */
function preselectMachineFromUrl() {
  const machineId = new URLSearchParams(window.location.search).get("machine");
  if (machineId && state.machinesById.has(machineId)) formMachine.value = machineId;
}

/* ---- Events and loading ---- */

machineFilter.addEventListener("change", (event) => {
  state.machineFilter = event.target.value;
  render();
});

formDescription.addEventListener("input", updateDescriptionCount);
form.addEventListener("submit", submitReport);

async function loadMachines() {
  const response = await fetch("./vending_machines.csv", { cache: "no-store" });
  if (!response.ok) throw new Error(`Machine data HTTP ${response.status}`);

  state.machinesById = new Map(parseCSV(await response.text()).map((machine) => [String(machine.ID), machine]));
  machineFilter.insertAdjacentHTML("beforeend", machineOptions());
  formMachine.insertAdjacentHTML("beforeend", machineOptions());
  preselectMachineFromUrl();
}

async function loadReports() {
  const response = await fetch(REPORTS_API, { cache: "no-store" });
  if (!response.ok) throw new Error(`Report data HTTP ${response.status}`);
  state.reports = normalizeReports(await response.json());
}

async function loadForum() {
  renderCategoryOptions();
  updateDescriptionCount();

  try {
    await loadMachines();
  } catch (error) {
    console.error("Unable to load machine data:", error);
    summary.textContent = "Unable to load machines";
    reportList.innerHTML = '<div class="error-state">Machine data could not be loaded. Run the site with <code>vercel dev</code> rather than opening forum.html directly.</div>';
    formSubmit.disabled = true;
    return;
  }

  try {
    await loadReports();
    render();
  } catch (error) {
    console.error("Unable to load SnackAttack reports:", error);
    summary.textContent = "Unable to load reports";
    reportList.innerHTML = '<div class="error-state">Reports could not be loaded right now. Please try again later.</div>';
  }
}

loadForum();
