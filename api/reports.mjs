/*
 * Vercel Function: GET /api/reports lists reports, POST /api/reports submits one.
 * Reports and photos are stored in Vercel Blob (see docs/forum-design.md).
 * Needs a Blob store connected to the Vercel project (BLOB_READ_WRITE_TOKEN,
 * or BLOB_STORE_ID with OIDC); `vercel env pull` provides it locally.
 */
import { list, put } from "@vercel/blob";
import { createReportHandlers } from "../reports-api.mjs";
import { loadMachineIds } from "./_machine-data.mjs"; // Valid IDs come from the machine data the API owns

const blobStore = {
  async listReports() {
    const blobs = [];
    let cursor;
    do {
      const page = await list({ prefix: "reports/", cursor });
      blobs.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    // Each report is its own small JSON file; skip any that can't be read
    const reports = await Promise.all(blobs.map(async (blob) => {
      const response = await fetch(blob.url);
      return response.ok ? response.json() : null;
    }));
    return reports.filter(Boolean);
  },

  async saveImage(pathname, bytes, contentType) {
    const blob = await put(pathname, Buffer.from(bytes), {
      access: "public",
      contentType,
      addRandomSuffix: false
    });
    return blob.url;
  },

  async saveReport(pathname, report) {
    await put(pathname, JSON.stringify(report), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false
    });
  }
};

export const { GET, POST } = createReportHandlers({ store: blobStore, loadMachineIds });
