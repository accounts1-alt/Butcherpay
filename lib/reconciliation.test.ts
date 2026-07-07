import { describe, expect, it } from "vitest";
import { reconcile } from "./reconciliation";

describe("reconcile", () => {
  it("matches when pos and recorded totals are equal", () => {
    const result = reconcile(100, 100);
    expect(result.gap).toBe(0);
    expect(result.matched).toBe(true);
  });

  it("reports a positive gap when POS total exceeds recorded total", () => {
    const result = reconcile(150, 120);
    expect(result.gap).toBe(30);
    expect(result.matched).toBe(false);
  });

  it("reports a negative gap when recorded total exceeds POS total", () => {
    const result = reconcile(90, 100);
    expect(result.gap).toBe(-10);
    expect(result.matched).toBe(false);
  });

  it("treats floating point noise around zero as matched", () => {
    const result = reconcile(0.1 + 0.2, 0.3);
    expect(result.gap).toBe(0);
    expect(result.matched).toBe(true);
  });

  it("does not treat a genuine 1p gap as matched", () => {
    const result = reconcile(100.01, 100);
    expect(result.gap).toBe(0.01);
    expect(result.matched).toBe(false);
  });

  it("handles both totals being zero", () => {
    const result = reconcile(0, 0);
    expect(result.gap).toBe(0);
    expect(result.matched).toBe(true);
  });
});
