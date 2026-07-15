import { describe, expect, it } from "vitest";
import { isPosFieldMapping, mapRows } from "./posSync";

const mapping = {
  date: "Date",
  location: "Location",
  payment_method: "Method",
  total: "Total",
};

describe("mapRows", () => {
  it("maps rows according to the field mapping", () => {
    const result = mapRows(
      [{ Date: "2026-07-01", Location: "Shop", Method: "card", Total: "123.45" }],
      mapping
    );
    expect(result).toEqual([
      { date: "2026-07-01", location: "Shop", paymentMethodName: "card", total: 123.45 },
    ]);
  });

  it("handles native (non-string) values from a DB row", () => {
    const result = mapRows(
      [{ Date: new Date("2026-07-01T00:00:00Z"), Location: "Shop", Method: "card", Total: 99.5 }],
      mapping
    );
    expect(result).toEqual([
      { date: "2026-07-01", location: "Shop", paymentMethodName: "card", total: 99.5 },
    ]);
  });

  it("drops rows with a missing field", () => {
    const result = mapRows(
      [{ Date: "2026-07-01", Location: "", Method: "card", Total: "100" }],
      mapping
    );
    expect(result).toEqual([]);
  });

  it("drops rows with a non-numeric total", () => {
    const result = mapRows(
      [{ Date: "2026-07-01", Location: "Shop", Method: "card", Total: "not-a-number" }],
      mapping
    );
    expect(result).toEqual([]);
  });
});

describe("isPosFieldMapping", () => {
  it("accepts a well-formed mapping", () => {
    expect(isPosFieldMapping(mapping)).toBe(true);
  });

  it("rejects a mapping missing a key", () => {
    expect(isPosFieldMapping({ date: "Date" })).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isPosFieldMapping(null)).toBe(false);
    expect(isPosFieldMapping("nope")).toBe(false);
  });
});
