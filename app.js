import { sortMachinesByDistance } from "./sort-utils.mjs";

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
  sort: "default"
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

function machineIcon(type) {
  const typeClass = type.toLowerCase().replaceAll(" ", "-");
  return L.divIcon({
    className: "",
    html: `<div class="machine-marker ${escapeHTML(typeClass)}"><span>${markerEmoji[type] || "🛒"}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -30]
  });
}

function renderMarkers(machines) {
  markerLayer.clearLayers();
  markersByMachineId.clear();

  machines.forEach((machine) => {
    const position = parseGPS(machine.GPS);
    if (!position) return;

    const distance = distanceLabel(machine.ID);
    const marker = L.marker(position, {
      icon: machineIcon(machine.Type),
      title: `${machine.Building} ${machine.Type} machine`
    })
      .bindPopup(`
        <div class="map-popup">
          <strong>${escapeHTML(machine.Building)} · ${escapeHTML(machine.Type)}</strong>
          ${distance ? `<span class="popup-distance">${distance}</span>` : ""}
          ${displayValue(machine.Payment)}<br />
          ${displayValue(machine.Directions)}
        </div>`)
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
            <button class="show-map-btn" type="button" data-machine-id="${escapeHTML(machine.ID)}">
              Show on map
            </button>
          </div>
          <span class="status ${statusClass(availability)}">${escapeHTML(availability)}</span>
        </div>
      </div>

      <button class="details-btn" type="button" aria-expanded="false" aria-controls="${id}" alt="Button to expand vending machine details.">
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
            <span>${displayValue(availability)}</span>
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

/**
 * Fetches JSON from one of the SnackAttack API endpoints (Task #4, PBI-38).
 * Throws with the API's error message when the request fails, so loadData()
 * shows an error instead of trying to use bad data.
 *
 * @param {string} path - API path, e.g. "/api/machines".
 * @returns {Promise<object>} The parsed JSON body.
 */
async function fetchApi(path) {
  const response = await fetch(path, { cache: "no-store" });

  // A non-JSON error page (e.g. a 404 from a static server) gives an empty body
  const body = await response.json().catch(() => ({}));

  if (!response.ok) throw new Error(body.error || `${path} returned HTTP ${response.status}`);
  return body;
}

/**
 * Loads machines and products from the machine API, then draws the page
 * and starts the simulated sensor.
 */
async function loadData() {
  try {
    // Data now comes from the machine API instead of reading the files directly
    const [machineData, productData] = await Promise.all([
      fetchApi("/api/machines"),
      fetchApi("/api/products")
    ]);

    // The API returns machines already parsed, so no CSV parsing is needed here
    state.machines = Array.isArray(machineData.machines) ? machineData.machines : [];
    state.productsByMachine = normalizeProducts(productData); // Same { products: [...] } shape as before
    calculateMachineDistances(); // Covers the case where location was found before data loaded
    updateMachinesByDistance();
    render();
  } catch (error) {
    console.error("Unable to load SnackAttack data:", error);
    summary.textContent = "Unable to load data";
    machineList.innerHTML = '<div class="error-state">SnackAttack data could not be loaded. If running locally, start the site with vercel dev so the API is available.</div>';
  }
}

loadData();
