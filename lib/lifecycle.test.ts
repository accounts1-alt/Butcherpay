import { describe, expect, it } from "vitest";
import { nextLifecycleStage } from "./lifecycle";

describe("nextLifecycleStage", () => {
  it("advances to the next stage", () => {
    expect(nextLifecycleStage(["taken", "posted", "banked"], "taken")).toBe("posted");
    expect(nextLifecycleStage(["taken", "posted", "banked"], "posted")).toBe("banked");
  });

  it("returns null once at the final stage", () => {
    expect(nextLifecycleStage(["taken", "posted", "banked"], "banked")).toBeNull();
  });

  it("returns null for a two-stage method at its final stage", () => {
    expect(nextLifecycleStage(["taken", "banked"], "banked")).toBeNull();
  });

  it("returns null for an unrecognized current stage", () => {
    expect(nextLifecycleStage(["taken", "banked"], "unknown")).toBeNull();
  });

  it("returns null for a single-stage (instant) method", () => {
    expect(nextLifecycleStage(["banked"], "banked")).toBeNull();
  });
});
