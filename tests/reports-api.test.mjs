import test from "node:test";
import assert from "node:assert/strict";
import { createReportHandlers } from "../reports-api.mjs";

// Fixed date and ID so results are repeatable
const FIXED_NOW = new Date("2026-11-03T20:00:00Z");
const FIXED_ID = "test-id";
const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);

/** In-memory stand-in for Vercel Blob that records what was saved. */
function createMockStore({ reports = [], failOn = null } = {}) {
  return {
    savedImages: [],
    savedReports: [],
    async listReports() {
      if (failOn === "list") throw new Error("list failed");
      return reports;
    },
    async saveImage(pathname, bytes, contentType) {
      if (failOn === "image") throw new Error("image failed");
      this.savedImages.push({ pathname, size: bytes.length, contentType });
      return `https://blob.example/${pathname}`;
    },
    async saveReport(pathname, report) {
      if (failOn === "report") throw new Error("report failed");
      this.savedReports.push({ pathname, report });
    }
  };
}

function createHandlers(store, overrides = {}) {
  return createReportHandlers({
    store,
    loadMachineIds: async () => new Set(["1", "2"]),
    now: () => FIXED_NOW,
    newId: () => FIXED_ID,
    logError: () => {}, // keep expected failures out of the test output
    ...overrides
  });
}

function reportRequest({ machineId = "1", category = "out-of-order", description = "Card reader broken.", image } = {}) {
  const form = new FormData();
  form.set("machineId", machineId);
  form.set("category", category);
  form.set("description", description);
  // A browser sends an empty, unnamed file when no photo is chosen
  form.set("image", image ?? new File([], "", { type: "application/octet-stream" }));
  return new Request("http://localhost/api/reports", { method: "POST", body: form });
}

/* ---- GET /api/reports ---- */

test("GET returns every stored report in a reports array", async () => {
  // Arrange
  const stored = [{ id: "a" }, { id: "b" }];
  const { GET } = createHandlers(createMockStore({ reports: stored }));

  // Act
  const response = await GET();

  // Assert
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reports: stored });
});

test("GET tells browsers not to cache the report list", async () => {
  // Arrange
  const { GET } = createHandlers(createMockStore());

  // Act
  const response = await GET();

  // Assert
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("GET returns a 500 error when storage can't be read", async () => {
  // Arrange
  const { GET } = createHandlers(createMockStore({ failOn: "list" }));

  // Act
  const response = await GET();

  // Assert
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /couldn't be loaded/);
});

/* ---- POST /api/reports ---- */

test("POST saves a valid report and returns it with status 201", async () => {
  // Arrange
  const store = createMockStore();
  const { POST } = createHandlers(store);

  // Act
  const response = await POST(reportRequest({ description: "  Card reader broken.  " }));

  // Assert
  const expected = {
    id: FIXED_ID,
    machineId: "1",
    category: "out-of-order",
    description: "Card reader broken.",
    submittedAt: "2026-11-03T20:00:00.000Z",
    imageUrl: null
  };
  assert.equal(response.status, 201);
  assert.deepEqual((await response.json()).report, expected);
  assert.deepEqual(store.savedReports, [{ pathname: `reports/${FIXED_ID}.json`, report: expected }]);
});

test("POST sets the submission date on the server, ignoring any date sent by the user", async () => {
  // Arrange
  const store = createMockStore();
  const { POST } = createHandlers(store);
  const request = reportRequest();
  const form = await request.formData();
  form.set("submittedAt", "1999-01-01T00:00:00Z");

  // Act
  const response = await POST(new Request("http://localhost/api/reports", { method: "POST", body: form }));

  // Assert
  assert.equal((await response.json()).report.submittedAt, "2026-11-03T20:00:00.000Z");
});

test("POST stores a valid photo and saves its URL on the report", async () => {
  // Arrange
  const store = createMockStore();
  const { POST } = createHandlers(store);
  const image = new File([PNG_BYTES], "machine.png", { type: "image/png" });

  // Act
  const response = await POST(reportRequest({ image }));

  // Assert
  assert.equal(response.status, 201);
  assert.deepEqual(store.savedImages, [{ pathname: `report-images/${FIXED_ID}.png`, size: 12, contentType: "image/png" }]);
  assert.equal((await response.json()).report.imageUrl, `https://blob.example/report-images/${FIXED_ID}.png`);
});

test("POST returns 400 with field errors and saves nothing for invalid fields", async () => {
  // Arrange
  const store = createMockStore();
  const { POST } = createHandlers(store);

  // Act
  const response = await POST(reportRequest({ machineId: "99", category: "nope", description: "" }));

  // Assert
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.deepEqual(Object.keys(body.errors), ["machineId", "category", "description"]);
  assert.equal(store.savedReports.length, 0);
});

test("POST rejects an unsupported image type", async () => {
  // Arrange
  const store = createMockStore();
  const { POST } = createHandlers(store);
  const image = new File(["GIF89a......"], "funny.gif", { type: "image/gif" });

  // Act
  const response = await POST(reportRequest({ image }));

  // Assert
  assert.equal(response.status, 400);
  assert.equal((await response.json()).errors.image, "Photos must be JPEG, PNG, or WebP images.");
  assert.equal(store.savedImages.length, 0);
});

test("POST rejects a file that claims to be a PNG but isn't an image", async () => {
  // Arrange
  const store = createMockStore();
  const { POST } = createHandlers(store);
  const image = new File(["MZ this is really a program"], "photo.png", { type: "image/png" });

  // Act
  const response = await POST(reportRequest({ image }));

  // Assert
  assert.equal(response.status, 400);
  assert.equal((await response.json()).errors.image, "That file isn't a valid JPEG, PNG, or WebP image.");
  assert.equal(store.savedImages.length, 0);
});

test("POST returns 400 when the body isn't form data", async () => {
  // Arrange
  const { POST } = createHandlers(createMockStore());
  const request = new Request("http://localhost/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });

  // Act
  const response = await POST(request);

  // Assert
  assert.equal(response.status, 400);
});

test("POST returns 500 when the report can't be saved", async () => {
  // Arrange
  const { POST } = createHandlers(createMockStore({ failOn: "report" }));

  // Act
  const response = await POST(reportRequest());

  // Assert
  assert.equal(response.status, 500);
  assert.equal((await response.json()).error, "Your report couldn't be saved. Please try again.");
});

test("POST returns 500 and saves no report when the photo upload fails", async () => {
  // Arrange
  const store = createMockStore({ failOn: "image" });
  const { POST } = createHandlers(store);
  const image = new File([PNG_BYTES], "machine.png", { type: "image/png" });

  // Act
  const response = await POST(reportRequest({ image }));

  // Assert
  assert.equal(response.status, 500);
  assert.equal(store.savedReports.length, 0);
});

test("POST returns 500 when the machine list can't be loaded", async () => {
  // Arrange
  const store = createMockStore();
  const { POST } = createHandlers(store, {
    loadMachineIds: async () => {
      throw new Error("csv missing");
    }
  });

  // Act
  const response = await POST(reportRequest());

  // Assert
  assert.equal(response.status, 500);
  assert.equal(store.savedReports.length, 0);
});
