/*
 * Request handlers for /api/reports (Task #7).
 *
 * Storage is passed in, so the handlers can be unit tested with an in-memory
 * store. api/reports.mjs wires them to Vercel Blob for production.
 *
 * store = {
 *   listReports(): Promise<object[]>                       // every saved report
 *   saveImage(pathname, bytes, contentType): Promise<url>  // returns the public URL
 *   saveReport(pathname, report): Promise<void>
 * }
 */
import {
  ALLOWED_IMAGE_TYPES,
  detectImageType,
  validateImageMeta,
  validateReportFields
} from "./report-validation.mjs";

const SAVE_FAILED = "Your report couldn't be saved. Please try again.";

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

/** A file input with nothing selected still submits an empty, unnamed File. */
function isEmptyFile(value) {
  return !value || typeof value === "string" || (value.size === 0 && !value.name);
}

/**
 * Creates the GET and POST handlers.
 * loadMachineIds() resolves to a Set of valid machine IDs (strings).
 * now() and newId() are injectable so tests get fixed dates and IDs.
 */
export function createReportHandlers({
  store,
  loadMachineIds,
  now = () => new Date(),
  newId = () => crypto.randomUUID(),
  logError = console.error
}) {
  async function GET() {
    try {
      const reports = await store.listReports();
      return json({ reports });
    } catch (error) {
      logError("Unable to list reports:", error);
      return json({ error: "Reports couldn't be loaded. Please try again later." }, 500);
    }
  }

  async function POST(request) {
    let form;
    try {
      form = await request.formData();
    } catch {
      return json({ error: "Send the report as a form submission.", errors: {} }, 400);
    }

    let machineIds;
    try {
      machineIds = await loadMachineIds();
    } catch (error) {
      logError("Unable to load machine list:", error);
      return json({ error: SAVE_FAILED }, 500);
    }

    const { errors, value } = validateReportFields(
      {
        machineId: form.get("machineId"),
        category: form.get("category"),
        description: form.get("description")
      },
      machineIds
    );

    const image = form.get("image");
    let imageBytes = null;
    let imageType = null;

    if (!isEmptyFile(image)) {
      const metaError = validateImageMeta({ type: image.type, size: image.size });
      if (metaError) {
        errors.image = metaError;
      } else {
        imageBytes = new Uint8Array(await image.arrayBuffer());
        imageType = detectImageType(imageBytes);
        if (!imageType) errors.image = "That file isn't a valid JPEG, PNG, or WebP image.";
      }
    }

    if (Object.keys(errors).length) {
      return json({ error: "Please fix the highlighted fields.", errors }, 400);
    }

    const id = newId();
    const report = {
      id,
      ...value,
      submittedAt: now().toISOString(),
      imageUrl: null
    };

    try {
      if (imageBytes) {
        const extension = ALLOWED_IMAGE_TYPES[imageType];
        report.imageUrl = await store.saveImage(`report-images/${id}.${extension}`, imageBytes, imageType);
      }
      await store.saveReport(`reports/${id}.json`, report);
    } catch (error) {
      logError("Unable to save report:", error);
      return json({ error: SAVE_FAILED }, 500);
    }

    return json({ report }, 201);
  }

  return { GET, POST };
}
