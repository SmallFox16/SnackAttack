import { sortMachinesByDistance } from "./sort-utils.mjs";

/* SnackAttack client application. */

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

function parseGPS(gps) {
  const [lat, lng] = (gps || "").split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

/* ---- Distance calculation (Task #13) ---- */

/**
 * Calculates the straight-line distance between two GPS points using the
 * Haversine formula, which accounts for the Earth's curvature.
 *
 * @param {[number, number]} from - [lat, lng] of the first point.
 * @param {[number, number]} to - [lat, lng] of the second point.
 * @returns {number} Distance in meters.
 */
function distanceInMeters([lat1, lng1], [lat2, lng2]) {
  const earthRadius = 6371000; // Mean radius of the Earth in meters

  // Trig functions in JavaScript expect radians, not degrees
  const toRad = (degrees) => (degrees * Math.PI) / 180;

  // Differences between the two points, in radians
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  // Haversine formula: "a" is the square of half the chord length between the points
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  // Convert to the angular distance, then multiply by the radius to get meters
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

/**
 * Calculates the distance from the user to every vending machine and stores
 * the results in state.distancesByMachine.
 * Does nothing if the user's location hasn't been retrieved yet.
 * Uses all machines (not just the filtered ones) so distances are always
 * available no matter which filters are active.
 */
function calculateMachineDistances() {
  // Clear old results so a new location doesn't mix with stale distances
  state.distancesByMachine.clear();

  // Can't calculate anything without the user's position
  if (!state.userLocation) return;

  const userPosition = [state.userLocation.lat, state.userLocation.lng];

  state.machines.forEach((machine) => {
    const machinePosition = parseGPS(machine.GPS);

    // Store null for machines missing GPS data so they still appear in the Map
    const distance = machinePosition ? distanceInMeters(userPosition, machinePosition) : null;

    state.distancesByMachine.set(String(machine.ID), distance);
  });
}

/**
 * Sorts machines from nearest to farthest using state.distancesByMachine.
 * Returns a new array so the original state.machines order is never changed.
 * If the user's location hasn't been retrieved yet, the original order is kept.
 * Machines without a distance (missing GPS) are placed at the end of the list.
 *
 * @param {object[]} machines - Machine rows to sort.
 * @returns {object[]} A new array of machines ordered nearest to farthest.
 */
function sortMachinesByDistance(machines) {
  // No location yet means no distances, so keep the CSV order
  if (!state.distancesByMachine.size) return machines;

  // Copy the array first because .sort() rearranges the array in place
  return [...machines].sort((a, b) => {
    const distanceA = state.distancesByMachine.get(String(a.ID));
    const distanceB = state.distancesByMachine.get(String(b.ID));

    // Push machines with no distance (null/undefined) to the bottom
    const aMissing = distanceA === null || distanceA === undefined;
    const bMissing = distanceB === null || distanceB === undefined;
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;

    // Smaller distance first = nearest to farthest
    return distanceA - distanceB;
  });
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
  state.machinesByDistance = sortMachinesByDistance(state.machines);
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

    const marker = L.marker(position, {
      icon: machineIcon(machine.Type),
      title: `${machine.Building} ${machine.Type} machine`
    })
      .bindPopup(`
        <div class="map-popup">
          <strong>${escapeHTML(machine.Building)} · ${escapeHTML(machine.Type)}</strong>
          ${displayValue(machine.Payment)}<br />
          ${displayValue(machine.Directions)}
        </div>`)
      .addTo(markerLayer);

    markersByMachineId.set(String(machine.ID), marker);
  });
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }

  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) => Object.fromEntries(
    headers.map((header, index) => [header, (values[index] || "").trim()])
  ));
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
  const distance = state.distancesByMachine.get(String(machine.ID));
  const distanceText = Number.isFinite(distance)
    ? `${distance < 1000 ? `${Math.round(distance)} m` : `${(distance / 1000).toFixed(2)} km`} away`
    : "Distance unavailable";

  return `
    <article class="machine-card" data-machine-id="${escapeHTML(machine.ID)}">
      <div class="card-main">
        <div class="card-heading">
          <div>
            <p class="machine-number">Machine #${escapeHTML(machine.ID)}</p>
            <h2>${escapeHTML(machine.Building)}</h2>
            <span class="machine-type">${escapeHTML(machine.Type)} machine</span>
            <span class="machine-distance">${escapeHTML(distanceText)}</span>
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
    updateMachinesByDistance();
    showUserOnMap(state.userLocation);
    render(); // Re-sort/re-display immediately if distance sorting is selected
    locationStatus.textContent = `Location found (±${Math.round(state.userLocation.accuracy)} m)`;
  } catch (error) {
    locationStatus.textContent = error.message;
  } finally {
    locateBtn.disabled = false;
  }
});

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
  } catch (error) {
    console.error("Unable to load SnackAttack data:", error);
    summary.textContent = "Unable to load data";
    machineList.innerHTML = '<div class="error-state">SnackAttack data could not be loaded. Run the site through a web server rather than opening index.html directly.</div>';
  }
}

loadData();
