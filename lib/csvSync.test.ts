import { describe, expect, it } from "vitest";
import { isPosCsvFieldMapping, mapCsvRows } from "./csvSync";

const mapping = {
  date: "Date",
  location: "Location",
  payment_method: "Method",
  total: "Total",
};

describe("mapCsvRows", () => {
  it("maps rows according to the field mapping", () => {
    const result = mapCsvRows(
      [{ Date: "2026-07-01", Location: "Shop", Method: "card", Total: "123.45" }],
      mapping
    );
    expect(result).toEqual([
      { date: "2026-07-01", location: "Shop", paymentMethodName: "card", total: 123.45 },
    ]);
  });

  it("drops rows with a missing field", () => {
    const result = mapCsvRows(
      [{ Date: "2026-07-01", Location: "", Method: "card", Total: "100" }],
      mapping
    );
    expect(result).toEqual([]);
  });

  it("drops rows with a non-numeric total", () => {
    const result = mapCsvRows(
      [{ Date: "2026-07-01", Location: "Shop", Method: "card", Total: "not-a-number" }],
      mapping
    );
    expect(result).toEqual([]);
  });
});

describe("isPosCsvFieldMapping", () => {
  it("accepts a well-formed mapping", () => {
    expect(isPosCsvFieldMapping(mapping)).toBe(true);
  });

  it("rejects a mapping missing a key", () => {
    expect(isPosCsvFieldMapping({ date: "Date" })).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isPosCsvFieldMapping(null)).toBe(false);
    expect(isPosCsvFieldMapping("nope")).toBe(false);
  });
});
