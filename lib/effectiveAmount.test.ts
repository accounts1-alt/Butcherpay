import { describe, expect, it } from "vitest";
import { effectiveNet } from "./effectiveAmount";

describe("effectiveNet", () => {
  it("uses amount - fee when there is no adjustment", () => {
    expect(effectiveNet({ amount: 100, fee: 5 })).toBe(95);
  });

  it("uses the latest adjustment's corrected amount instead of the original", () => {
    expect(effectiveNet({ amount: 100, fee: 5 }, { corrected_amount: 120 })).toBe(115);
  });

  it("treats a null adjustment the same as no adjustment", () => {
    expect(effectiveNet({ amount: 100, fee: 5 }, null)).toBe(95);
  });
});
