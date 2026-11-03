import test from "node:test";
import assert from "node:assert/strict";
import { parseCSV } from "../csv-utils.mjs";

test("parseCSV maps rows to objects keyed by the header row", () => {
  const rows = parseCSV("ID,Building,GPS\n1,Brinkley,\"36.30, -82.37\"\n");

  assert.deepEqual(rows, [{ ID: "1", Building: "Brinkley", GPS: "36.30, -82.37" }]);
});

test("parseCSV handles escaped quotes, CRLF endings, and blank rows", () => {
  const rows = parseCSV('ID,Details\r\n1,"Says ""hi"""\r\n\r\n2,Plain');

  assert.deepEqual(rows, [
    { ID: "1", Details: 'Says "hi"' },
    { ID: "2", Details: "Plain" }
  ]);
});

test("parseCSV returns an empty list when there is no data row", () => {
  assert.deepEqual(parseCSV(""), []);
  assert.deepEqual(parseCSV("ID,Building\n"), []);
});
