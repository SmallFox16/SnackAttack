# Logging and Monitoring Standard

## Purpose

This document defines what SnackAttack should log and what it should monitor, so problems are noticed and can be traced to a cause. It covers the pages (`index.html`, `forum.html`), the Vercel Functions under `api/`, and the local dev server (`scripts/dev-server.mjs`).

- **Logging** records individual events (an error, a failed request) so a developer can find out what went wrong.
- **Monitoring** watches the overall health of the site over time (uptime, error rates, response times) so the team notices problems before users report them.

## Where logs go

| Code | Runs in | Logs appear in |
|---|---|---|
| `api/*.mjs`, `machines-api.mjs`, `reports-api.mjs` | Vercel Functions (Node) | Vercel dashboard → project → **Logs** (runtime logs) |
| `scripts/dev-server.mjs` | Local Node | The terminal running `npm start` |
| `app.js`, `forum.js` | User's browser | Browser DevTools console only (not collected) |

Server code logs with `console.error` / `console.warn` / `console.log`; Vercel captures all of these. Handlers take an injectable `logError` (default `console.error`) so unit tests can check that a failure was logged without printing to the test output. New handlers should follow the same pattern.

## Log levels

| Level | Use for | Example |
|---|---|---|
| `error` | A request failed because of something on our side (data or storage unavailable, unexpected exception). Someone may need to act. | `Unable to load machine data:` |
| `warn` | Something unexpected that the code handled, but that points to bad data or a bug. | `No map marker found for machine 12` |
| `info` (`console.log`) | Normal startup and lifecycle events. Use sparingly. | `SnackAttack running at http://localhost:3000` |

Do not log normal successful requests from the API code. Vercel already records every request (path, status, duration), so logging them again just adds noise.

## What should be logged

### Server (Vercel Functions and dev server)

| Event | Level | Where | Include |
|---|---|---|---|
| Machine or product data can't be read or parsed (`data/vending_machines.csv`, `data/products.json`) | error | `machines-api.mjs` (`withData`) | Endpoint, error message and stack |
| Machine ID list can't be loaded while validating a report | error | `reports-api.mjs` (`POST`) | Error message and stack |
| Reports can't be listed from Vercel Blob | error | `reports-api.mjs` (`GET`) | Error message and stack |
| A report or photo can't be saved to Vercel Blob | error | `reports-api.mjs` (`POST`) | Report ID, Blob pathname, error message |
| A stored report blob can't be fetched or parsed and is skipped | warn | `api/reports.mjs` (`listReports`) | Blob pathname, HTTP status |
| Machine data loads but has rows with missing ID, building, or coordinates | warn | `api/_machine-data.mjs` (`loadData`) | Row number and missing field (once per load, not per request) |
| Unhandled exception in the dev server | error | `scripts/dev-server.mjs` | Method, URL, error |
| Dev server started | info | `scripts/dev-server.mjs` | Host and port |

Report validation failures (HTTP 400, such as a missing description or an image that's too large) are **not** logged. They are user input mistakes, not server problems, and the form already shows the user the error.

### Browser (`app.js`, `forum.js`)

Browser logs only appear in the user's own DevTools console. They help when debugging locally or when a user can share a screenshot of the console.

| Event | Level | Where |
|---|---|---|
| `/api/machines` or `/api/products` request fails or returns non-OK | error | `app.js`, `forum.js` |
| `/api/reports` load or submit fails (network error or 5xx) | error | `forum.js` |
| A machine in the data has no map marker | warn | `app.js` |
| Geolocation is denied or unavailable | Not logged. This is a normal user choice, and the page shows a status message instead. | `app.js` |

### Never log

- **User location.** Coordinates from the browser's geolocation API must never be sent to the server or written to any log.
- **Report contents beyond the ID.** Don't log descriptions or photos; they are user-written content.
- **Secrets.** Never log `BLOB_READ_WRITE_TOKEN`, other environment variables, or full request headers (which can contain cookies or tokens).
- **IP addresses or other identifiers** in our own logs. Vercel keeps its own request logs; we don't add to them.

### Log message format

- Start with a short, fixed phrase that says what failed (`"Unable to save report:"`), then pass the error object as the second argument so the stack trace is kept.
- Keep the fixed phrase the same everywhere it's used, so logs can be searched by it.
- Include IDs (machine ID, report ID, Blob pathname) when they help find the cause; never include the data covered under [Never log](#never-log).

## What should be monitored

| What | Why | How | Alert when |
|---|---|---|---|
| **Site uptime** (`/` and `/forum`) | Users can't use SnackAttack if the pages are down | Vercel deployment status; an external uptime check (e.g. UptimeRobot free tier) hitting `/` every 5 minutes | Two checks in a row fail |
| **Machine API health** (`/api/machines`) | Both pages depend on it; if it fails, no machines are shown | Uptime check on `/api/machines` expecting HTTP 200 with a non-empty `machines` array | Non-200, or an empty list |
| **API error rate** (5xx responses on `/api/*`) | Shows data-loading or Blob storage failures | Vercel dashboard → **Logs** / **Observability**, filtered to status 5xx | Any 5xx sustained for more than 5 minutes, or more than 5% of requests in an hour |
| **API response time** | Slow responses make the map and forum feel broken | Vercel Observability function duration | Typical (p95) duration above 2 seconds |
| **Report submissions** (`POST /api/reports`) | A broken submit form loses user reports silently | Count of 201 vs. 500 responses in Vercel logs | Any 500 on submit |
| **Vercel Blob usage** | The free plan has storage and request limits; going over them breaks reports | Vercel dashboard → **Storage** | Above 80% of the plan limit |
| **Function invocations / bandwidth** | Staying within Vercel's free plan limits | Vercel dashboard → **Usage** | Above 80% of the plan limit |
| **CI quality checks** (`quality.yml`, `accessibility.yml`) | Failing lint, unit, or accessibility checks mean a regression is about to be merged | GitHub Actions results on each PR and on `dev-*` / `main` pushes | Any failed run on a `dev-*` or `main` branch |
| **Deployment failures** | A failed build means fixes aren't reaching users | Vercel deployment notifications (email / GitHub status) | Any failed production deployment |

### Who checks and when

- Alerts (uptime checks, Vercel deployment failures) go to the team by email.
- At the start of each sprint, one team member reviews the Vercel **Logs**, **Usage**, and **Storage** pages and notes anything unusual in the sprint planning notes.
- Before a release branch (`release-sprint-N`) is merged to `main`, confirm there are no unresolved `error` logs from the current production deployment.

## Pull request checklist

When a PR adds or changes server code or a page that calls the API:

- [ ] New failure paths log at `error` with a fixed message and the error object.
- [ ] Handled-but-unexpected cases log at `warn`.
- [ ] No user location, report content, secrets, or identifiers are logged.
- [ ] New handlers accept an injectable `logError` and have a unit test that checks the failure is logged.
- [ ] Any new endpoint is added to the uptime/health checks above if pages depend on it.

## Current limitations

- Browser errors are not collected; we only see them if a user shares their console. A client-side error reporting service could be added later if needed.
- Vercel's free plan keeps runtime logs for a short time only, so logs must be checked soon after a problem is reported.
- Alerts depend on the external uptime checker being set up on the team's account; it is not part of the repository.
