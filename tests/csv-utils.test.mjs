import test from "node:test";
import assert from "node:assert/strict";
import { parseCSV } from "../csv-utils.mjs";

test("parseCSV maps each row to an object keyed by the header row", () => {
  // Arrange
  const csv = "ID,Building,Type\n1,Brinkley,Drink\n";

  // Act
  const rows = parseCSV(csv);

  // Assert
  assert.deepEqual(rows, [{ ID: "1", Building: "Brinkley", Type: "Drink" }]);
});

test("parseCSV keeps commas inside quoted fields", () => {
  // Arrange
  const csv = 'ID,GPS\n1,"36.30, -82.37"\n';

  // Act
  const rows = parseCSV(csv);

  // Assert
  assert.deepEqual(rows, [{ ID: "1", GPS: "36.30, -82.37" }]);
});

test("parseCSV turns doubled quotes into a single quote", () => {
  // Arrange
  const csv = 'ID,Details\n1,"Says ""hi"""\n';

  // Act
  const rows = parseCSV(csv);

  // Assert
  assert.deepEqual(rows, [{ ID: "1", Details: 'Says "hi"' }]);
});

test("parseCSV reads Windows (CRLF) line endings", () => {
  // Arrange
  const csv = "ID,Building\r\n1,Brinkley\r\n2,Ball";

  // Act
  const rows = parseCSV(csv);

  // Assert
  assert.deepEqual(rows, [
    { ID: "1", Building: "Brinkley" },
    { ID: "2", Building: "Ball" }
  ]);
});

test("parseCSV skips blank rows", () => {
  // Arrange
  const csv = "ID,Building\n1,Brinkley\n\n,\n2,Ball\n";

  // Act
  const rows = parseCSV(csv);

  // Assert
  assert.deepEqual(rows.map((row) => row.ID), ["1", "2"]);
});

test("parseCSV returns an empty list for empty text or a header with no data", () => {
  // Act / Assert
  assert.deepEqual(parseCSV(""), []);
  assert.deepEqual(parseCSV("ID,Building\n"), []);
});
