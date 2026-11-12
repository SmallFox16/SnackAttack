/*
 * Local development server (Task #4, PBI-38).
 * Serves the site's static files and runs the machine API endpoints, so the
 * front end can be tested locally without the Vercel CLI.
 *
 *   npm run dev   ->   http://localhost:3000
 *
 * Note: /api/reports (the forum) needs Vercel Blob storage, so it isn't served here.
 */
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { GET as getMachines } from "./api/machines.mjs";
import { GET as getProducts } from "./api/products.mjs";
import { GET as getBuildings } from "./api/buildings.mjs";

const PORT = Number(process.env.PORT) || 3000;
const ROOT = process.cwd();

// API paths and the handler that serves each one
const API_ROUTES = {
  "/api/machines": getMachines,
  "/api/products": getProducts,
  "/api/buildings": getBuildings
};

// Content types for the static files the site uses
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

/**
 * Runs an API handler. Converts Node's request into a web-standard Request
 * (what the handlers expect) and copies the returned Response back to Node.
 */
async function serveApi(handler, req, res) {
  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "application/json", Allow: "GET" });
    res.end(JSON.stringify({ error: "Only GET is supported." }));
    return;
  }

  const response = await handler(new Request(`http://localhost:${PORT}${req.url}`));
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

/**
 * Serves a file from the project folder. "/" maps to index.html, and
 * extensionless paths like "/forum" map to forum.html (like cleanUrls on Vercel).
 */
async function serveStatic(pathname, res) {
  let filePath = pathname === "/" ? "/index.html" : pathname;
  if (!path.extname(filePath)) filePath += ".html";

  // Block paths like /../secret that would escape the project folder
  const fullPath = path.resolve(ROOT, `.${decodeURIComponent(filePath)}`);
  if (!fullPath.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const body = await readFile(fullPath);
    const type = CONTENT_TYPES[path.extname(fullPath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type }).end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);

  try {
    const handler = API_ROUTES[pathname];
    if (handler) {
      await serveApi(handler, req, res);
    } else {
      await serveStatic(pathname, res);
    }
  } catch (error) {
    console.error("Dev server error:", error);
    res.writeHead(500, { "Content-Type": "text/plain" }).end("Server error");
  }
});

server.listen(PORT, () => {
  console.log(`SnackAttack dev server running at http://localhost:${PORT}`);
});