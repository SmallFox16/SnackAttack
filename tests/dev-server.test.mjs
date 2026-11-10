import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { ROOT, apiModulePath, resolveStaticPath } from "../scripts/dev-server.mjs";

/* Unit tests for the local dev server's path rules (scripts/dev-server.mjs). */

const file = (...parts) => path.join(ROOT, ...parts);

/* ---- resolveStaticPath ---- */

test("resolveStaticPath serves index.html for the site root", () => {
  assert.equal(resolveStaticPath("/"), file("index.html"));
});

test("resolveStaticPath serves a file by its path", () => {
  assert.equal(resolveStaticPath("/styles.css"), file("styles.css"));
  assert.equal(resolveStaticPath("/forum.html"), file("forum.html"));
});

test("resolveStaticPath adds .html to clean URLs like Vercel", () => {
  assert.equal(resolveStaticPath("/forum"), file("forum.html"));
});

test("resolveStaticPath refuses the data folder so data only comes from the API", () => {
  assert.equal(resolveStaticPath("/data/vending_machines.csv"), null);
  assert.equal(resolveStaticPath("/data/products.json"), null);
});

test("resolveStaticPath refuses API source, scripts, tests, and dependencies", () => {
  assert.equal(resolveStaticPath("/api/_machine-data.mjs"), null);
  assert.equal(resolveStaticPath("/scripts/dev-server.mjs"), null);
  assert.equal(resolveStaticPath("/tests/dev-server.test.mjs"), null);
  assert.equal(resolveStaticPath("/node_modules/@vercel/blob/package.json"), null);
});

test("resolveStaticPath refuses hidden files such as .env.local", () => {
  assert.equal(resolveStaticPath("/.env.local"), null);
  assert.equal(resolveStaticPath("/.git/config"), null);
});

test("resolveStaticPath refuses paths that climb out of the project folder", () => {
  assert.equal(resolveStaticPath("/../secret.txt"), null);
  assert.equal(resolveStaticPath("/docs/../../secret.txt"), null);
  assert.equal(resolveStaticPath("/..\\secret.txt"), null);
});

/* ---- apiModulePath ---- */

test("apiModulePath finds the function file for an API path", () => {
  assert.equal(apiModulePath("/api/machines"), file("api", "machines.mjs"));
  assert.equal(apiModulePath("/api/reports"), file("api", "reports.mjs"));
});

test("apiModulePath ignores shared helper files that start with an underscore", () => {
  assert.equal(apiModulePath("/api/_machine-data"), null);
});

test("apiModulePath returns null for an API path with no function", () => {
  assert.equal(apiModulePath("/api/unknown"), null);
  assert.equal(apiModulePath("/api/machines/3"), null);
  assert.equal(apiModulePath("/machines"), null);
});
