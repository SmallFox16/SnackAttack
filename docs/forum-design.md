# Community Reports Forum Design (Task #8)

## Purpose

The community reports page (`forum.html`) lets users see reports and updates about specific vending machines: machines out of order, products that are unavailable, incorrect pricing, and other issues. It belongs to the "submit and view machine reports" user story (priority 8, Medium).

Task #8 covers **viewing** reports and getting to the page from `index.html`. Submitting reports, uploading images, and shared server storage are separate tasks (see [Not yet built](#not-yet-built)).

## Navigation

Both pages share a header nav (`<nav class="site-nav" aria-label="Main">`):

| Link | Target |
|---|---|
| Machine finder | `./` (`index.html`) |
| Community reports | `./forum.html` |

The link for the current page has `aria-current="page"`, which is styled gold. On Vercel, `cleanUrls` serves `forum.html` at `/forum`, and `/forum.html` redirects there.

## Shared styles

The inline `<style>` block from `index.html` was moved unchanged into `styles.css`, and both pages link it. Forum and nav styles are appended at the end of that file, so the forum reuses the existing colors, cards, empty/error states, and the 620px mobile breakpoint without duplicating CSS.

## Report data model

Reports are stored in `reports.json`:

```json
{
  "reports": [
    {
      "id": "r1",
      "machineId": 1,
      "category": "out-of-order",
      "description": "Card reader is broken, cash only right now.",
      "submittedAt": "2026-11-03T14:10:00Z",
      "imageUrl": null
    }
  ]
}
```

| Field | Required | Rules |
|---|---|---|
| `id` | No | Unique ID. If missing, `<machineId>-<timestamp>` is used. |
| `machineId` | Yes | The `ID` column from `vending_machines.csv`. A number or string is accepted and compared as a string. |
| `category` | Yes | One of the keys in `REPORT_CATEGORIES` below. |
| `description` | Yes | Non-empty text after trimming. Line breaks are kept. |
| `submittedAt` | Yes | ISO 8601 date-time string (UTC recommended). |
| `imageUrl` | No | An `http(s)` URL or a relative path. Anything else, such as `javascript:` or `data:`, is ignored. |

### Categories

Defined once in `forum-utils.mjs` as `REPORT_CATEGORIES`, so the future submit form can use the same list:

| Key | Label |
|---|---|
| `out-of-order` | Machine out of order |
| `product-unavailable` | Product unavailable |
| `incorrect-pricing` | Incorrect pricing |
| `other` | Other issue |

## How reports are displayed

`forum.js` (browser only) does the following:

1. It fetches `vending_machines.csv` and `reports.json` at the same time.
2. It parses the CSV with `parseCSV` from `csv-utils.mjs`, the same parser `app.js` uses, and builds a `machinesById` map.
3. It runs `normalizeReports` (in `forum-utils.mjs`), which drops any report that fails validation and sorts the rest **newest first**. A malformed record is skipped instead of breaking the page.
4. It fills the **Filter by machine** dropdown from the CSV and renders one card per report:
   - machine number and name, e.g. "Brinkley Drink machine (#1)", or "Machine #7" if the ID isn't in the CSV
   - category badge
   - description
   - optional photo
   - "Submitted <date>" in the viewer's local time

All report text goes through `escapeHTML` before it is inserted, so text a user submits cannot inject HTML or scripts.

### Empty and error states

| Situation | Message |
|---|---|
| No valid reports at all | "No reports yet. Reports about machine issues, pricing, and availability will appear here once users submit them." |
| A machine filter matches nothing | "No reports for this machine yet." |
| `reports.json` or the CSV fails to load | Error card telling the user to run the site through a web server |

## How reports are stored

For now, `reports.json` is a static file that is deployed with the site and starts empty. The site has no backend, so users cannot write to it yet.

The submit task will add shared storage, for example a Vercel Function backed by a database for report records and Blob storage for images. Whatever it uses should return the same `{ "reports": [...] }` shape. Then only the `fetch` URL in `forum.js` needs to change, and the validation in `normalizeReport` is reused unchanged.

## Not yet built

These parts of the user story are for later tasks:

- Report submission form: pick a machine, pick a category, enter a description
- Server-side validation and saving reports so other users can see them
- Image upload, with file-type and size validation
- A per-machine "View reports" link from each machine card in `index.html`

## Testing

- `tests/forum-utils.test.mjs` covers category lookup, report validation (missing fields, unknown category, invalid date, non-object input, unsafe image URLs), sorting, empty or malformed data, machine filtering, machine labels, date formatting, and HTML escaping.
- `tests/csv-utils.test.mjs` covers the shared CSV parser.
- `tests/accessibility.spec.js` runs axe (WCAG 2.1 A/AA) against `forum.html` as well as the home page.

See [`testing.md`](testing.md) for the test table and the mobile checklist.
