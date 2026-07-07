import { describe, expect, it } from "vitest";
import { resolveDateRange } from "./dateRanges";

// Wednesday 2026-07-08 (UTC) as a fixed "today" for deterministic tests.
const wednesday = new Date("2026-07-08T12:00:00Z");

describe("resolveDateRange", () => {
  it("today is a single-day range", () => {
    expect(resolveDateRange("today", wednesday)).toEqual({
      from: "2026-07-08",
      to: "2026-07-08",
    });
  });

  it("week runs from Monday to today", () => {
    expect(resolveDateRange("week", wednesday)).toEqual({
      from: "2026-07-06",
      to: "2026-07-08",
    });
  });

  it("month runs from the 1st to today", () => {
    expect(resolveDateRange("month", wednesday)).toEqual({
      from: "2026-07-01",
      to: "2026-07-08",
    });
  });

  it("custom uses the provided from/to", () => {
    expect(
      resolveDateRange("custom", wednesday, { from: "2026-06-01", to: "2026-06-15" })
    ).toEqual({ from: "2026-06-01", to: "2026-06-15" });
  });

  it("custom swaps from/to if given in the wrong order", () => {
    expect(
      resolveDateRange("custom", wednesday, { from: "2026-06-15", to: "2026-06-01" })
    ).toEqual({ from: "2026-06-01", to: "2026-06-15" });
  });

  it("custom falls back to today when fields are missing", () => {
    expect(resolveDateRange("custom", wednesday, {})).toEqual({
      from: "2026-07-08",
      to: "2026-07-08",
    });
  });

  it("week on a Monday starts on that same Monday", () => {
    const monday = new Date("2026-07-06T00:00:00Z");
    expect(resolveDateRange("week", monday)).toEqual({
      from: "2026-07-06",
      to: "2026-07-06",
    });
  });
});
