import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_DESCRIPTION_LENGTH,
  MAX_IMAGE_BYTES,
  detectImageType,
  validateImageMeta,
  validateReportFields
} from "../report-validation.mjs";

// Mock machine IDs, as loaded from vending_machines.csv
const machineIds = new Set(["1", "2", "3"]);

// Mock valid form fields; each test overrides one field
const validFields = { machineId: "1", category: "out-of-order", description: "Card reader is broken." };

// First bytes of real image formats, padded to 12 bytes
const JPEG_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const WEBP_BYTES = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

/* ---- validateReportFields ---- */

test("validateReportFields accepts a complete report with no errors", () => {
  // Act
  const { errors } = validateReportFields(validFields, machineIds);

  // Assert
  assert.deepEqual(errors, {});
});

test("validateReportFields trims the fields it returns", () => {
  // Arrange
  const fields = { machineId: " 2 ", category: " other ", description: "  Lights are off.  " };

  // Act
  const { value } = validateReportFields(fields, machineIds);

  // Assert
  assert.deepEqual(value, { machineId: "2", category: "other", description: "Lights are off." });
});

test("validateReportFields accepts a numeric machine ID", () => {
  // Arrange
  const fields = { ...validFields, machineId: 3 };

  // Act
  const { errors, value } = validateReportFields(fields, machineIds);

  // Assert
  assert.deepEqual(errors, {});
  assert.equal(value.machineId, "3");
});

test("validateReportFields requires a machine", () => {
  // Arrange
  const fields = { ...validFields, machineId: "" };

  // Act
  const { errors } = validateReportFields(fields, machineIds);

  // Assert
  assert.equal(errors.machineId, "Choose the machine this report is about.");
});

test("validateReportFields rejects a machine ID that isn't in the machine data", () => {
  // Arrange
  const fields = { ...validFields, machineId: "99" };

  // Act
  const { errors } = validateReportFields(fields, machineIds);

  // Assert
  assert.equal(errors.machineId, "That machine doesn't exist. Choose one from the list.");
});

test("validateReportFields requires a category", () => {
  // Arrange
  const fields = { ...validFields, category: null };

  // Act
  const { errors } = validateReportFields(fields, machineIds);

  // Assert
  assert.equal(errors.category, "Choose a report category.");
});

test("validateReportFields rejects a category that isn't listed", () => {
  // Arrange
  const fields = { ...validFields, category: "vandalism" };

  // Act
  const { errors } = validateReportFields(fields, machineIds);

  // Assert
  assert.equal(errors.category, "Choose one of the listed categories.");
});

test("validateReportFields requires a description that isn't just spaces", () => {
  // Arrange
  const fields = { ...validFields, description: "   " };

  // Act
  const { errors } = validateReportFields(fields, machineIds);

  // Assert
  assert.equal(errors.description, "Describe the issue.");
});

test("validateReportFields accepts a description exactly at the length limit", () => {
  // Arrange
  const fields = { ...validFields, description: "a".repeat(MAX_DESCRIPTION_LENGTH) };

  // Act
  const { errors } = validateReportFields(fields, machineIds);

  // Assert
  assert.equal(errors.description, undefined);
});

test("validateReportFields rejects a description one character over the limit", () => {
  // Arrange
  const fields = { ...validFields, description: "a".repeat(MAX_DESCRIPTION_LENGTH + 1) };

  // Act
  const { errors } = validateReportFields(fields, machineIds);

  // Assert
  assert.match(errors.description, /1000 characters or fewer \(currently 1001\)/);
});

test("validateReportFields reports every invalid field at once", () => {
  // Act
  const { errors } = validateReportFields({}, machineIds);

  // Assert
  assert.deepEqual(Object.keys(errors), ["machineId", "category", "description"]);
});

test("validateReportFields handles missing input without throwing", () => {
  // Act
  const { errors } = validateReportFields(undefined, machineIds);

  // Assert
  assert.equal(Object.keys(errors).length, 3);
});

/* ---- validateImageMeta ---- */

test("validateImageMeta accepts each supported image type", () => {
  // Arrange
  const types = Object.keys(ALLOWED_IMAGE_TYPES);

  // Act
  const results = types.map((type) => validateImageMeta({ type, size: 1024 }));

  // Assert
  assert.deepEqual(types, ["image/jpeg", "image/png", "image/webp"]);
  assert.deepEqual(results, [null, null, null]);
});

test("validateImageMeta rejects an unsupported file type", () => {
  // Act
  const error = validateImageMeta({ type: "image/gif", size: 1024 });

  // Assert
  assert.equal(error, "Photos must be JPEG, PNG, or WebP images.");
});

test("validateImageMeta rejects a file with no type", () => {
  // Act
  const error = validateImageMeta({ type: "", size: 1024 });

  // Assert
  assert.equal(error, "Photos must be JPEG, PNG, or WebP images.");
});

test("validateImageMeta rejects an empty file", () => {
  // Act
  const error = validateImageMeta({ type: "image/png", size: 0 });

  // Assert
  assert.equal(error, "The photo file is empty.");
});

test("validateImageMeta accepts an image exactly at the 4 MB limit", () => {
  // Act
  const error = validateImageMeta({ type: "image/jpeg", size: MAX_IMAGE_BYTES });

  // Assert
  assert.equal(error, null);
});

test("validateImageMeta rejects an image one byte over 4 MB", () => {
  // Act
  const error = validateImageMeta({ type: "image/jpeg", size: MAX_IMAGE_BYTES + 1 });

  // Assert
  assert.equal(error, "Photos must be 4 MB or smaller.");
});

/* ---- detectImageType ---- */

test("detectImageType recognizes a JPEG from its first bytes", () => {
  // Act
  const type = detectImageType(JPEG_BYTES);

  // Assert
  assert.equal(type, "image/jpeg");
});

test("detectImageType recognizes a PNG from its first bytes", () => {
  // Act
  const type = detectImageType(PNG_BYTES);

  // Assert
  assert.equal(type, "image/png");
});

test("detectImageType recognizes a WebP from its RIFF/WEBP header", () => {
  // Act
  const type = detectImageType(WEBP_BYTES);

  // Assert
  assert.equal(type, "image/webp");
});

test("detectImageType rejects a non-image file renamed as an image", () => {
  // Arrange (a Windows .exe starts with "MZ")
  const exeBytes = Uint8Array.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0]);

  // Act
  const type = detectImageType(exeBytes);

  // Assert
  assert.equal(type, null);
});

test("detectImageType rejects a RIFF file that isn't WebP", () => {
  // Arrange (a WAV audio file is RIFF....WAVE)
  const wavBytes = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);

  // Act
  const type = detectImageType(wavBytes);

  // Assert
  assert.equal(type, null);
});

test("detectImageType rejects data too short to identify", () => {
  // Act / Assert
  assert.equal(detectImageType(Uint8Array.from([0xff, 0xd8, 0xff])), null);
  assert.equal(detectImageType(null), null);
});
