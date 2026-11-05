/*
 * Validation for submitted community reports (Task #7).
 * Used by both the form in forum.js and the server in reports-api.mjs,
 * so the browser and the API apply the same rules. No DOM or Node APIs.
 */
import { categoryLabel } from "./forum-utils.mjs";

export const MAX_DESCRIPTION_LENGTH = 1000;

// Vercel Functions accept request bodies up to 4.5 MB, so images stay under that.
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Supported image MIME types -> file extension used when the image is stored. */
export const ALLOWED_IMAGE_TYPES = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
});

/**
 * Checks the text fields of a report.
 * Returns { errors, value }: errors maps field name -> message (empty when valid),
 * value holds the cleaned machineId, category, and description.
 */
export function validateReportFields(fields, validMachineIds) {
  const machineId = String(fields?.machineId ?? "").trim();
  const category = String(fields?.category ?? "").trim();
  const description = String(fields?.description ?? "").trim();
  const errors = {};

  if (!machineId) {
    errors.machineId = "Choose the machine this report is about.";
  } else if (!validMachineIds.has(machineId)) {
    errors.machineId = "That machine doesn't exist. Choose one from the list.";
  }

  if (!category) {
    errors.category = "Choose a report category.";
  } else if (!categoryLabel(category)) {
    errors.category = "Choose one of the listed categories.";
  }

  if (!description) {
    errors.description = "Describe the issue.";
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Keep the description to ${MAX_DESCRIPTION_LENGTH} characters or fewer (currently ${description.length}).`;
  }

  return { errors, value: { machineId, category, description } };
}

/**
 * Checks an image's declared type and size (what the browser reports for a File).
 * Returns an error message, or null when the image is acceptable.
 */
export function validateImageMeta({ type, size }) {
  if (!Object.hasOwn(ALLOWED_IMAGE_TYPES, type)) {
    return "Photos must be JPEG, PNG, or WebP images.";
  }
  if (!Number.isFinite(size) || size <= 0) {
    return "The photo file is empty.";
  }
  if (size > MAX_IMAGE_BYTES) {
    return "Photos must be 4 MB or smaller.";
  }
  return null;
}

function startsWith(bytes, signature, offset = 0) {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * Identifies an image from its first bytes ("magic numbers") rather than its
 * file name or declared type, so a renamed non-image file is rejected.
 * Returns "image/jpeg", "image/png", "image/webp", or null.
 */
export function detectImageType(bytes) {
  if (!bytes || bytes.length < 12) return null;

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";

  // WebP: "RIFF" <4-byte size> "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }

  return null;
}
