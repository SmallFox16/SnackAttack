# Community Reports Forum Design (Tasks #7 and #8)

## Purpose

The community reports page (`forum.html`) lets users view and submit reports about specific vending machines: machines out of order, products that are unavailable, incorrect pricing, and other issues. It belongs to the "submit and view machine reports" user story (priority 8, Medium).

| Task | Covers |
|---|---|
| #8 | Forum page, navigation from `index.html`, displaying reports |
| #7 | Submit form, validation, image upload, and shared storage (Vercel Function + Vercel Blob) |

## Overview

```text
forum.html / forum.js (browser)
  │  GET  /api/reports              → { reports: [...] }
  │  POST /api/reports (form data)  → 201 { report } | 400 { error, errors } | 500 { error }
  ▼
api/reports.mjs (Vercel Function)  ── wires handlers to Vercel Blob
  └─ reports-api.mjs (handlers)     ── validation via report-validation.mjs
        ▼
Vercel Blob (public store)
  reports/<id>.json            one JSON file per report
  report-images/<id>.<ext>     optional photo (jpg, png, webp)
```

## Navigation

Both pages share a header nav (`<nav class="site-nav" aria-label="Main">`):

| Link | Target |
|---|---|
| Machine finder | `./` (`index.html`) |
| Community reports | `./forum.html` |

The link for the current page has `aria-current="page"`, which is styled gold. On Vercel, `cleanUrls` serves `forum.html` at `/forum`, and `/forum.html` redirects there.

`?machine=<ID>` pre-selects that machine in the submit form, so other pages can link straight to "report this machine". Link to **`/forum?machine=<ID>`**. On the deployed site, `/forum.html?machine=<ID>` also works because Vercel's `cleanUrls` redirect keeps the query string. Locally, `vercel dev` drops the query string on that redirect, so only `/forum?machine=<ID>` works there.

## Shared styles

The inline `<style>` block from `index.html` was moved unchanged into `styles.css`, and both pages link it. Nav, forum, and form styles are appended at the end of that file, so the forum reuses the existing colors, cards, empty/error states, and the 620px mobile breakpoint without duplicating CSS.

## Report data model

Each stored report (and each item in the `GET /api/reports` response) looks like this:

```json
{
  "id": "6f1c2a9e-1b7d-4c3e-9a51-0e8f4b2d7c10",
  "machineId": "1",
  "category": "out-of-order",
  "description": "Card reader is broken, cash only right now.",
  "submittedAt": "2026-11-03T14:10:00.000Z",
  "imageUrl": "https://<store>.public.blob.vercel-storage.com/report-images/6f1c2a9e-….jpg"
}
```

| Field | Set by | Rules |
|---|---|---|
| `id` | Server | Random UUID (`crypto.randomUUID()`). Also used as the storage file name. |
| `machineId` | User | Must be an `ID` from `vending_machines.csv`. Stored as a string. |
| `category` | User | One of the keys in `REPORT_CATEGORIES` below. |
| `description` | User | Required. 1–1,000 characters after trimming. Line breaks are kept. |
| `submittedAt` | Server | ISO 8601 UTC time when the server received the report. A date sent by the user is ignored, so reports can't be backdated. |
| `imageUrl` | Server | Blob URL of the uploaded photo, or `null`. When displayed, only `http(s)` URLs or relative paths are used; anything else (e.g. `javascript:`) is ignored. |

### Categories

Defined once in `forum-utils.mjs` as `REPORT_CATEGORIES`. The form's radio buttons, the server validation, and the category badges all use this list:

| Key | Label |
|---|---|
| `out-of-order` | Machine out of order |
| `product-unavailable` | Product unavailable |
| `incorrect-pricing` | Incorrect pricing |
| `other` | Other issue |

## How reports are submitted

### The form (`forum.html` + `forum.js`)

| Field | Input | Notes |
|---|---|---|
| Machine | `<select>` filled from `vending_machines.csv` | Pre-selected from `?machine=<ID>` |
| Category | Radio buttons generated from `REPORT_CATEGORIES` | Inside a `<fieldset>` with a `<legend>` |
| Description | `<textarea maxlength="1000">` | Live "N / 1000 characters" counter |
| Photo (optional) | `<input type="file" accept="image/jpeg,image/png,image/webp">` | Hint: "JPEG, PNG, or WebP, up to 4 MB." |

When the user submits:

1. `forum.js` runs the **same validation the server runs** (`validateReportFields` and `validateImageMeta` from `report-validation.mjs`). Errors appear under each field, the field is marked `aria-invalid="true"`, the first invalid field gets focus, and nothing is uploaded.
2. If the form is valid, it sends `POST /api/reports` as `multipart/form-data` and disables the button while waiting.
3. On **201**, the new report is added to the top of the list without reloading, the form resets, and a success message is announced (`role="status"`).
4. On **400**, the server's field errors are shown the same way as the browser's.
5. On **500** or a network failure, a general "couldn't be saved/sent, try again" message is shown and the form keeps what the user typed.

### The server (`reports-api.mjs`, deployed as `api/reports.mjs`)

`POST /api/reports`:

1. Reads the form data. A body that isn't form data → **400**.
2. Loads the valid machine IDs from `vending_machines.csv`. The file is bundled with the function through `includeFiles` in `vercel.json`, and the result is cached per function instance.
3. Validates the fields with `validateReportFields`. The rules are in the table above.
4. If a photo was chosen:
   - `validateImageMeta` checks the declared type (JPEG, PNG, or WebP) and size (1 byte to 4 MB). Vercel Functions accept request bodies up to 4.5 MB, so 4 MB leaves room for the other fields.
   - `detectImageType` checks the file's **first bytes** (its "magic number"). A text file or program renamed to `.png` is rejected even if the browser says it's `image/png`. The detected type, not the declared one, sets the stored file's extension and content type.
5. If anything is invalid → **400** `{ error, errors: { field: message } }`. Nothing is stored.
6. Otherwise it stores the photo first, then the report JSON, and returns **201** `{ report }`. If storage fails → **500**. If the photo upload fails, no report is saved.

## How reports are stored

Reports and photos are stored in a **public Vercel Blob store** connected to the `snack-attack` Vercel project.

| Path | Content |
|---|---|
| `reports/<id>.json` | One report, in the format above |
| `report-images/<id>.jpg` / `.png` / `.webp` | The report's photo, if it has one |

- **One file per report.** Two people submitting at the same time never overwrite each other, so there's no shared list to lock or merge.
- **`GET /api/reports`** lists everything under `reports/`, page by page until the end, then reads each file. Unreadable files are skipped. The response has `Cache-Control: no-store`, so new reports show up right away.
- **Public access** fits this data: reports are meant to be read by everyone, and photo URLs go straight into `<img>` tags.
- **Why Blob instead of a database:** it's one first-party Vercel service with no schema or connection setup, and listing and reading each file is fast enough for the number of reports a campus app will have. If reports grow into the thousands or need searching, the next step is moving report records into a Postgres database such as Neon from the Vercel Marketplace, keeping photos in Blob. Only `api/reports.mjs` would change, because the handlers take the store as a parameter.

### Credentials

`@vercel/blob` reads its credentials from the environment. When the store is connected to the project in the Vercel dashboard, Vercel adds `BLOB_READ_WRITE_TOKEN` (or `BLOB_STORE_ID` for OIDC). Locally, `vercel env pull .env.local` copies them; `.env*` files are git-ignored. No secrets are in the code.

## How reports are displayed

`forum.js` (browser only) does the following:

1. It fetches `vending_machines.csv`, parses it with `parseCSV` from `csv-utils.mjs` (the same parser `app.js` uses), and fills both machine dropdowns.
2. It fetches `GET /api/reports` and runs `normalizeReports` (in `forum-utils.mjs`), which drops any report that fails validation and sorts the rest **newest first**. A malformed record is skipped instead of breaking the page.
3. It renders one card per report:
   - machine number and name, e.g. "Brinkley Drink machine (#1)", or "Machine #7" if the ID isn't in the CSV
   - category badge
   - description
   - optional photo
   - "Submitted <date>" in the viewer's local time

All report text goes through `escapeHTML` before it is inserted, so text a user submits cannot inject HTML or scripts.

### Empty and error states

| Situation | Message |
|---|---|
| No reports yet | "No reports yet. Be the first to submit one using the form above." |
| A machine filter matches nothing | "No reports for this machine yet." |
| `GET /api/reports` fails (e.g. storage not connected) | "Reports could not be loaded right now. Please try again later." The form still works. |
| The machine CSV fails to load | Error card, and the submit button is disabled |

## Known limitations and security trade-offs

- **No user accounts or rate limiting.** Anyone can submit reports, so the forum could be spammed. The limits that do exist are the 1,000-character description cap, the 4 MB photo cap, server-side validation, and checking machine IDs against the CSV. Adding sign-in or rate limiting, for example with Upstash Redis, is a candidate for a later task.
- **No moderation or deletion in the app.** Bad reports can be removed by deleting their files from the Blob store in the Vercel dashboard.
- **Photos are public** as soon as they're uploaded, and their metadata, such as GPS location in the EXIF data, is not stripped. Users should not upload photos showing people.
- **Listing reads every report file.** That's fine for hundreds of reports, but see the database note above for growth.

## Testing

- `tests/report-validation.test.mjs` has 24 tests. They cover:
  - each field rule, including the exact 1,000-character and 4 MB boundaries
  - image type detection for JPEG, PNG and WebP, a renamed `.exe`, a WAV file, and data too short to identify
- `tests/reports-api.test.mjs` has 13 tests of the GET and POST handlers, using an in-memory mock store. They cover:
  - 201 with and without a photo, and that the server sets the date
  - 400 for invalid fields, an unsupported type, a fake image, and a body that isn't form data
  - 500 for storage, photo upload, and machine-list failures
- `tests/forum-utils.test.mjs` has 30 tests and `tests/csv-utils.test.mjs` has 6 tests.
- `forum.js` and the Blob adapter in `api/reports.mjs` are not unit tested. [`testing.md`](testing.md#not-unit-tested-and-why) explains why and what covers them instead.
- `tests/accessibility.spec.js` runs axe (WCAG 2.1 A/AA) against `forum.html`, including the form, as well as the home page.

All tests follow [`unit-test-standard.md`](unit-test-standard.md). See [`testing.md`](testing.md) for the test tables and the mobile checklist.
