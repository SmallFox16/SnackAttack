import { sortMachinesByDistance } from "./sort-utils.mjs";
import { applySensorMessage, startSimulatedSensor, storeSensorMessage } from "./iot-sensor.mjs";
import { parseCSV } from "./csv-utils.mjs";
import { formatLastUpdated } from "./iot-display.mjs";

/* SnackAttack client application. */

// Unit system for displayed distances: "imperial" (ft/mi) or "metric" (m/km)
const DISTANCE_UNIT = "imperial";

const state = {
  machines: [],
  productsByMachine: new Map(),
  type: "All",
  search: "",
  userLocation: null,
  distancesByMachine: new Map(),
  machinesByDistance: [],
  sort: "default",
  sensorMessages: new Map()
};

const machineList = document.getElementById("machineList");
const summary = document.getElementById("summary");
const search = document.getElementById("search");
const filters = document.getElementById("filters");
const sortSelect = document.getElementById("sortSelect");
const sortHint = document.getElementById("sortHint");

const campusMap = L.map("campus-map").setView([36.3035, -82.37], 16);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
  maxZoom: 19
}).addTo(campusMap);

const markerLayer = L.layerGroup().addTo(campusMap);
const markersByMachineId = new Map();

const markerEmoji = {
  Drink: "🥤",
  Snack: "🍫",
  "Personal Care": "🧴"
};

/* ---- Distance calculation (Task #13) ----
 * parseGPS and calculateDistances live in distance.js so they can be unit tested.
 */

/**
 * Recalculates the distance from the user to every vending machine and stores
 * the results in state.distancesByMachine (empty until the user's location is known).
 */
function calculateMachineDistances() {
  // Replace the whole Map so a new location doesn't mix with stale distances
  state.distancesByMachine = calculateDistances(state.userLocation, state.machines);
}

/**
 * Returns the display text for a machine's distance from the user (Task #12),
 * or an empty string if the user's location isn't known yet.
 */
function distanceLabel(machineId) {
  if (!state.userLocation) return "";

  const meters = state.distancesByMachine.get(String(machineId));
  const text = formatDistance(meters, DISTANCE_UNIT);

  // Machines without GPS just say "Distance unavailable"
  return Number.isFinite(meters) ? `${text} away` : text;
}

/**
 * Stores all machines in nearest-to-farthest order in state.machinesByDistance.
 * Does not update the UI; it only calculates and saves the sorted order.
 * Leaves the array empty if the user's location hasn't been retrieved yet.
 */
function updateMachinesByDistance() {
  // No distances means there's nothing to sort by
  if (!state.distancesByMachine.size) {
    state.machinesByDistance = [];
    return;
  }

  // Sort every machine (not just filtered ones) so the result works with any filter
  state.machinesByDistance = sortMachinesByDistance(state.machines, state.distancesByMachine);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function displayValue(value, fallback = "Not yet recorded") {
  return value ? escapeHTML(value) : fallback;
}

function statusClass(status = "Unknown") {
  const normalized = String(status).toLowerCase();
  if (normalized === "available") return "available";
  if (normalized === "unavailable") return "unavailable";
  return "unknown";
}

/**
 * Builds a map pin for a machine. Out-of-service machines get a grayed-out pin
 * so their status is visible on the map (Task #2).
 */
function machineIcon(type, availability = "Unknown") {
  const typeClass = type.toLowerCase().replaceAll(" ", "-");
  const serviceClass = statusClass(availability) === "unavailable" ? " out-of-service" : "";

  return L.divIcon({
    className: "",
    html: `<div class="machine-marker ${escapeHTML(typeClass)}${serviceClass}"><span>${markerEmoji[type] || "🛒"}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -30]
  });
}

/**
 * Builds a machine's map popup. Kept in one place so renderMarkers() and live
 * sensor updates produce the same popup, including the current status (Task #2).
 */
function popupMarkup(machine) {
  const distance = distanceLabel(machine.ID);
  const availability = machine.Availability || "Unknown";

  return `
    <div class="map-popup">
      <strong>${escapeHTML(machine.Building)} · ${escapeHTML(machine.Type)}</strong>
      <span class="status popup-status ${statusClass(availability)}">${escapeHTML(availability)}</span>
      ${distance ? `<span class="popup-distance">${distance}</span>` : ""}
      ${displayValue(machine.Payment)}<br />
      ${displayValue(machine.Directions)}
    </div>`;
}

function renderMarkers(machines) {
  markerLayer.clearLayers();
  markersByMachineId.clear();

  machines.forEach((machine) => {
    const position = parseGPS(machine.GPS);
    if (!position) return;

    const marker = L.marker(position, {
      icon: machineIcon(machine.Type, machine.Availability),
      title: `${machine.Building} ${machine.Type} machine`
    })
      .bindPopup(popupMarkup(machine))
      .addTo(markerLayer);

    markersByMachineId.set(String(machine.ID), marker);
  });
}

function normalizeProducts(data) {
  const byMachine = new Map();
  const products = Array.isArray(data.products) ? data.products : [];

  products.forEach((product) => {
    const machineId = String(product.machineId ?? "");
    if (!byMachine.has(machineId)) byMachine.set(machineId, []);
    byMachine.get(machineId).push(product);
  });

  return byMachine;
}

function formatPrice(price) {
  return typeof price === "number" && Number.isFinite(price)
    ? `$${price.toFixed(2)}`
    : "Price not recorded";
}

function productMarkup(machineId) {
  const products = state.productsByMachine.get(String(machineId)) || [];

  if (!products.length) {
    return '<div class="product-empty">No product-level data has been recorded for this machine yet.</div>';
  }

  return `<div class="product-list">${products.map((product) => {
    const availability = product.availability || "Unknown";
    return `
      <div class="product-row">
        <span class="product-name">${escapeHTML(product.name)}</span>
        <span class="product-price">${escapeHTML(formatPrice(product.price))}</span>
        <span class="product-status ${statusClass(availability)}">${escapeHTML(availability)}</span>
      </div>`;
  }).join("")}</div>`;
}

function machineCard(machine) {
  const id = `details-${machine.ID}`;
  const availability = machine.Availability || "Unknown";
  const distance = distanceLabel(machine.ID);

  return `
    <article class="machine-card" data-machine-id="${escapeHTML(machine.ID)}">
      <div class="card-main">
        <div class="card-heading">
          <div>
            <p class="machine-number">Machine #${escapeHTML(machine.ID)}</p>
            <h2>${escapeHTML(machine.Building)}</h2>
            <span class="machine-type">${escapeHTML(machine.Type)} machine</span>
            ${distance ? `<p class="machine-distance">📍 ${distance}</p>` : ""}
            <p class="last-updated" aria-live="off">${escapeHTML(lastUpdatedText(machine.ID))}</p>
            <button class="show-map-btn" type="button" data-machine-id="${escapeHTML(machine.ID)}">
              Show on map
            </button>
          </div>
          <span class="status ${statusClass(availability)}">${escapeHTML(availability)}</span>
        </div>
      </div>

      <button class="details-btn" type="button" aria-expanded="false" aria-controls="${id}">
        <span>View machine information</span>
        <span class="chevron" aria-hidden="true">⌄</span>
      </button>

      <div class="details" id="${id}" hidden>
        <div class="detail-grid">
          <div class="detail-item">
            <strong>Machine type</strong>
            <span>${displayValue(machine.Type)}</span>
          </div>
          <div class="detail-item">
            <strong>Machine availability</strong>
            <span class="machine-availability">${displayValue(availability)}</span>
          </div>
          <div class="detail-item">
            <strong>Payment</strong>
            <span>${displayValue(machine.Payment)}</span>
          </div>
          <div class="detail-item">
            <strong>GPS</strong>
            <span>${displayValue(machine.GPS)}</span>
          </div>
          <div class="detail-item full">
            <strong>Directions</strong>
            <span>${displayValue(machine.Directions)}</span>
          </div>
          <div class="detail-item full">
            <strong>Details</strong>
            <span>${displayValue(machine.Details)}</span>
          </div>
          <section class="product-section" aria-label="Product prices and availability">
            <h3>Products, prices, and availability</h3>
            ${productMarkup(machine.ID)}
          </section>
        </div>
      </div>
    </article>`;
}

function filteredMachines() {
  const searchTerm = state.search.trim().toLowerCase();
  return state.machines.filter((machine) => {
    const typeMatches = state.type === "All" || machine.Type === state.type;
    const searchMatches = !searchTerm || machine.Building.toLowerCase().includes(searchTerm);
    return typeMatches && searchMatches;
  });
}

function displayedMachines() {
  const machines = filteredMachines();
  return state.sort === "distance"
    ? sortMachinesByDistance(machines, state.distancesByMachine)
    : machines;
}

function updateSortAvailability() {
  const distanceOption = sortSelect.querySelector('option[value="distance"]');
  const hasLocation = Boolean(state.userLocation);
  distanceOption.disabled = !hasLocation;

  if (!hasLocation && state.sort === "distance") {
    state.sort = "default";
    sortSelect.value = "default";
  }

  sortHint.textContent = hasLocation
    ? "Distance sorting is available."
    : "Use your location to enable nearest-to-farthest sorting.";
}

function render() {
  updateSortAvailability();
  const machines = displayedMachines();
  summary.textContent = `${machines.length} of ${state.machines.length} machine${state.machines.length === 1 ? "" : "s"} shown`;
  renderMarkers(machines);

  if (!machines.length) {
    machineList.innerHTML = '<div class="empty-state">No vending machines match the current filters.</div>';
    return;
  }

  machineList.innerHTML = machines.map(machineCard).join("");
}

filters.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-type]");
  if (!button) return;

  state.type = button.dataset.type;
  filters.querySelectorAll("button[data-type]").forEach((filterButton) => {
    const active = filterButton === button;
    filterButton.classList.toggle("active", active);
    filterButton.setAttribute("aria-pressed", String(active));
  });
  render();
});

search.addEventListener("input", (event) => {
  state.search = event.target.value;
  render();
});

sortSelect.addEventListener("change", (event) => {
  state.sort = event.target.value;
  render();
});

machineList.addEventListener("click", (event) => {
  const mapButton = event.target.closest(".show-map-btn");

  if (mapButton) {
    const machineId = mapButton.dataset.machineId;
    const marker = markersByMachineId.get(String(machineId));

    if (!marker) {
      console.warn(`No map marker found for machine ${machineId}`);
      return;
    }

    const position = marker.getLatLng();
    campusMap.setView(position, 18, { animate: true });
    marker.openPopup();

    document.getElementById("campus-map-section").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    return;
  }

  const detailsButton = event.target.closest(".details-btn");
  if (!detailsButton) return;

  const details = document.getElementById(detailsButton.getAttribute("aria-controls"));
  const expanded = detailsButton.getAttribute("aria-expanded") === "true";
  detailsButton.setAttribute("aria-expanded", String(!expanded));
  details.hidden = expanded;
});

/* ---- User geolocation (Task #14) ---- */
const locateBtn = document.getElementById("locateBtn");
const locationStatus = document.getElementById("locationStatus");
let userMarker = null;
let accuracyCircle = null;

function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        const messages = {
          [error.PERMISSION_DENIED]: "Location permission was denied.",
          [error.POSITION_UNAVAILABLE]: "Your location is currently unavailable.",
          [error.TIMEOUT]: "Location request timed out. Try again."
        };
        reject(new Error(messages[error.code] || "Could not get your location."));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

function showUserOnMap({ lat, lng, accuracy }) {
  const position = [lat, lng];

  if (userMarker) {
    userMarker.setLatLng(position);
    accuracyCircle.setLatLng(position).setRadius(accuracy);
  } else {
    accuracyCircle = L.circle(position, {
      radius: accuracy,
      color: "#1f6fd1",
      fillOpacity: 0.1,
      weight: 1,
      interactive: false
    }).addTo(campusMap);

    userMarker = L.circleMarker(position, {
      radius: 8,
      color: "#fff",
      weight: 2,
      fillColor: "#1f6fd1",
      fillOpacity: 1
    })
      .bindPopup('<div class="map-popup"><strong>You are here</strong></div>')
      .addTo(campusMap);
  }

  campusMap.setView(position, 17, { animate: true });
  userMarker.openPopup();
}

locateBtn.addEventListener("click", async () => {
  locateBtn.disabled = true;
  locationStatus.textContent = "Finding your location…";

  try {
    state.userLocation = await getUserLocation();
    calculateMachineDistances(); // Location changed, so recalculate distances

    // Redraw cards and popups with distances (loadData renders them if data isn't loaded yet)
    if (state.machines.length) render();

    showUserOnMap(state.userLocation);
    render(); // Re-sort/re-display immediately if distance sorting is selected
    locationStatus.textContent = `Location found (±${Math.round(state.userLocation.accuracy)} m)`;
  } catch (error) {
    locationStatus.textContent = error.message;
  } finally {
    locateBtn.disabled = false;
  }
});

/* ---- Simulated IoT sensor (Tasks #4, #3, #2) ----
 * Message format, validation, the simulator, and applying stock updates live in
 * iot-sensor.mjs; display helpers live in iot-display.mjs so they can be unit tested.
 */
let sensorTimer = null; // Interval ID, kept so the sensor can't be started twice
const LAST_UPDATED_REFRESH_MS = 30000; // How often "Updated X ago" labels are refreshed

/**
 * Returns the "last updated" label for a machine's card, based on its
 * latest sensor message (Task #2).
 */
function lastUpdatedText(machineId) {
  const message = state.sensorMessages.get(String(machineId));
  return message ? formatLastUpdated(message.timestamp) : "No sensor reading yet";
}

/**
 * Finds a machine's card on the page, or null if it's hidden by the filters.
 */
function findMachineCard(machineId) {
  return document.getElementById(`details-${machineId}`)?.closest(".machine-card") || null;
}

/**
 * Shows a new status on a badge or label. Skips unchanged text so the
 * aria-live machine list only announces real changes.
 *
 * @returns {boolean} True if the status actually changed (used to highlight it).
 */
function updateStatusText(element, status, baseClass) {
  if (!element || element.textContent === status) return false;

  element.textContent = status;
  if (baseClass) element.className = `${baseClass} ${statusClass(status)}`;
  return true;
}

/**
 * Plays a highlight animation on an element (Task #2). If the animation is
 * already running, it restarts so back-to-back updates are still visible.
 */
function playHighlight(element, className) {
  element.classList.remove(className);
  element.getBoundingClientRect(); // Forces the browser to notice the removal so the animation restarts
  element.classList.add(className);
  element.addEventListener("animationend", () => element.classList.remove(className), { once: true });
}

/**
 * Updates one machine's card in place. A full render() would collapse open
 * details panels and close map popups every time a sensor reported.
 * Changed badges pop and the card glows so users can see what changed (Task #2).
 * Machines hidden by the current filters have no card; render() shows their
 * latest values when they reappear.
 */
function updateMachineCard(machine) {
  const card = findMachineCard(machine.ID);
  if (!card) return;

  const changedBadges = [];

  const statusBadge = card.querySelector(".status");
  if (updateStatusText(statusBadge, machine.Availability, "status")) changedBadges.push(statusBadge);
  updateStatusText(card.querySelector(".machine-availability"), machine.Availability);

  // Rows are drawn in the same order as the machine's product list
  const products = state.productsByMachine.get(String(machine.ID)) || [];
  card.querySelectorAll(".product-status").forEach((element, index) => {
    const availability = products[index]?.availability || "Unknown";
    if (updateStatusText(element, availability, "product-status")) changedBadges.push(element);
  });

  changedBadges.forEach((badge) => playHighlight(badge, "iot-changed"));
  if (changedBadges.length) playHighlight(card, "iot-updated");
}

/**
 * Updates a machine's map pin and popup to match its current status (Task #2).
 * setPopupContent also refreshes a popup that's currently open.
 */
function updateMachineMarker(machine) {
  const marker = markersByMachineId.get(String(machine.ID));
  if (!marker) return;

  marker.setIcon(machineIcon(machine.Type, machine.Availability));
  marker.setPopupContent(popupMarkup(machine));
}

/**
 * Refreshes every visible card's "Updated X ago" label so the times stay accurate.
 */
function refreshLastUpdatedLabels() {
  machineList.querySelectorAll(".machine-card").forEach((card) => {
    const label = card.querySelector(".last-updated");
    if (label) label.textContent = lastUpdatedText(card.dataset.machineId);
  });
}

/**
 * Handles one sensor message: rejects it if malformed, keeps it as the latest
 * reading for its machine, applies it to the stock, then updates the card and map.
 */
function handleSensorMessage(message) {
  if (!storeSensorMessage(state.sensorMessages, message)) return;

  const changedMachine = applySensorMessage(state.machines, state.productsByMachine, message);
  if (changedMachine) {
    updateMachineCard(changedMachine);
    updateMachineMarker(changedMachine);
  }

  // Every valid reading refreshes the label, even when nothing changed
  const label = findMachineCard(message.machineId)?.querySelector(".last-updated");
  if (label) label.textContent = lastUpdatedText(message.machineId);
}

/**
 * Starts the simulated sensor once machines have loaded. Each message goes
 * through handleSensorMessage, so the cards and map update as readings arrive.
 * Also starts refreshing the "Updated X ago" labels.
 */
function startSensor() {
  if (sensorTimer || !state.machines.length) return;

  sensorTimer = startSimulatedSensor(state.machines, state.productsByMachine, handleSensorMessage);
  setInterval(refreshLastUpdatedLabels, LAST_UPDATED_REFRESH_MS); // Keep "Updated X ago" labels current
}


async function loadData() {
  try {
    const [machineResponse, productResponse] = await Promise.all([
      fetch("./vending_machines.csv", { cache: "no-store" }),
      fetch("./products.json", { cache: "no-store" })
    ]);

    if (!machineResponse.ok) throw new Error(`Machine data HTTP ${machineResponse.status}`);
    if (!productResponse.ok) throw new Error(`Product data HTTP ${productResponse.status}`);

    const [csv, productData] = await Promise.all([
      machineResponse.text(),
      productResponse.json()
    ]);

    state.machines = parseCSV(csv);
    state.productsByMachine = normalizeProducts(productData);
    calculateMachineDistances(); // Covers the case where location was found before data loaded
    updateMachinesByDistance();
    render();
    startSensor();
  } catch (error) {
    console.error("Unable to load SnackAttack data:", error);
    summary.textContent = "Unable to load data";
    machineList.innerHTML = '<div class="error-state">SnackAttack data could not be loaded. Run the site through a web server rather than opening index.html directly.</div>';
  }
}

loadData();
