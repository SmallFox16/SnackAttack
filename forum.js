/* Community reports forum page (Task #8). Report logic lives in forum-utils.mjs. */
import { parseCSV } from "./csv-utils.mjs";
import {
  categoryLabel,
  escapeHTML,
  filterReportsByMachine,
  formatReportDate,
  machineLabel,
  normalizeReports
} from "./forum-utils.mjs";

const state = {
  reports: [],
  machinesById: new Map(),
  machineFilter: "all"
};

const reportList = document.getElementById("reportList");
const summary = document.getElementById("reportSummary");
const machineFilter = document.getElementById("machineFilter");

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
    reportList.innerHTML = '<div class="empty-state">No reports yet. Reports about machine issues, pricing, and availability will appear here once users submit them.</div>';
    return;
  }

  if (!reports.length) {
    reportList.innerHTML = '<div class="empty-state">No reports for this machine yet.</div>';
    return;
  }

  reportList.innerHTML = reports.map(reportCard).join("");
}

function populateMachineFilter() {
  const options = [...state.machinesById.values()].map((machine) =>
    `<option value="${escapeHTML(machine.ID)}">${escapeHTML(machineLabel(state.machinesById, machine.ID))}</option>`
  );
  machineFilter.insertAdjacentHTML("beforeend", options.join(""));
}

machineFilter.addEventListener("change", (event) => {
  state.machineFilter = event.target.value;
  render();
});

async function loadForum() {
  try {
    const [machineResponse, reportResponse] = await Promise.all([
      fetch("./vending_machines.csv", { cache: "no-store" }),
      fetch("./reports.json", { cache: "no-store" })
    ]);

    if (!machineResponse.ok) throw new Error(`Machine data HTTP ${machineResponse.status}`);
    if (!reportResponse.ok) throw new Error(`Report data HTTP ${reportResponse.status}`);

    const [csv, reportData] = await Promise.all([machineResponse.text(), reportResponse.json()]);

    state.machinesById = new Map(parseCSV(csv).map((machine) => [String(machine.ID), machine]));
    state.reports = normalizeReports(reportData);
    populateMachineFilter();
    render();
  } catch (error) {
    console.error("Unable to load SnackAttack reports:", error);
    summary.textContent = "Unable to load reports";
    reportList.innerHTML = '<div class="error-state">Reports could not be loaded. Run the site through a web server rather than opening forum.html directly.</div>';
  }
}

loadForum();
