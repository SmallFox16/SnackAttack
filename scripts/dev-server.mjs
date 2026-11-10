/*
 * Local server for SnackAttack: serves the pages and runs the API functions in
 * api/ the way Vercel does, so the site works without the Vercel CLI.
 *
 *   npm start                  http://localhost:8000
 *   PORT=4173 npm start        another port (CI uses 4173)
 *
 * /api/reports also needs Blob credentials (see README); without them the forum
 * shows "Reports could not be loaded" and the rest of the site still works.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Folders that are never served as files: data/ is only read through the API
const PRIVATE_DIRS = new Set(["api", "data", "node_modules", "scripts", "tests"]);

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

/**
 * Finds the API function file for a request path, e.g. /api/machines -> api/machines.mjs.
 * Names starting with "_" are shared helpers, not endpoints, matching Vercel.
 *
 * @param {string} pathname - The URL path.
 * @param {string} [root=ROOT] - Project folder.
 * @returns {string|null} The absolute file path, or null if no function matches.
 */
export function apiModulePath(pathname, root = ROOT) {
  const match = /^\/api\/([a-z][a-z0-9-]*)$/.exec(pathname);
  if (!match) return null;

  const file = path.join(root, "api", `${match[1]}.mjs`);
  return existsSync(file) ? file : null;
}

/**
 * Maps a URL path to a file that may be served, applying Vercel's clean URLs
 * (/forum -> forum.html, / -> index.html).
 *
 * @param {string} pathname - The URL path (already decoded).
 * @param {string} [root=ROOT] - Project folder.
 * @returns {string|null} The absolute file path, or null if the path isn't allowed.
 */
export function resolveStaticPath(pathname, root = ROOT) {
  const segments = pathname.split("/").filter(Boolean);

  // Block hidden files (.env.local, .git), parent-folder tricks, and private folders
  if (segments.some((segment) => segment.startsWith(".") || segment.includes("\\"))) return null;
  if (segments.length && PRIVATE_DIRS.has(segments[0])) return null;

  const file = path.join(root, ...segments);
  if (!file.startsWith(root + path.sep) && file !== root) return null;

  if (!segments.length) return path.join(root, "index.html");
  return path.extname(file) ? file : `${file}.html`;
}

/** Runs an API function and copies its web Response onto the Node response. */
async function handleApi(file, req, res, url) {
  const module = await import(pathToFileURL(file).href);
  const handler = module[req.method];

  if (typeof handler !== "function") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: `${req.method} is not supported here.` }));
    return;
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? "half" : undefined
  });

  const response = await handler(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

/** Serves one file, or a 404 if it isn't allowed or doesn't exist. */
async function handleStatic(pathname, res) {
  const file = resolveStaticPath(pathname);
  const info = file ? await stat(file).catch(() => null) : null;

  if (!info?.isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, {
    "Content-Type": CONTENT_TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  res.end(await readFile(file));
}

/**
 * Creates the server. API functions read data/ relative to the current folder,
 * so start it from the project folder (npm start does this).
 */
export function createDevServer() {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const pathname = decodeURIComponent(url.pathname);
      const apiFile = apiModulePath(pathname);

      if (apiFile) {
        await handleApi(apiFile, req, res, url);
      } else if (pathname.startsWith("/api/")) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No API endpoint at this path." }));
      } else {
        await handleStatic(pathname, res);
      }
    } catch (error) {
      console.error(`Error handling ${req.method} ${req.url}:`, error);
      if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Server error");
    }
  });
}

// Start the server only when run directly (node scripts/dev-server.mjs), not when imported by tests
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8000;
  const host = process.env.HOST || "127.0.0.1";
  createDevServer().listen(port, host, () => {
    console.log(`SnackAttack running at http://${host === "127.0.0.1" ? "localhost" : host}:${port}`);
  });
}
