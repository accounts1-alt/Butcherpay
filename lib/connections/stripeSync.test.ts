import { describe, expect, it } from "vitest";
import { isStripeConnectionConfig } from "./stripeSync";

describe("isStripeConnectionConfig", () => {
  it("accepts a well-formed config", () => {
    expect(isStripeConnectionConfig({ secret_key: "rk_live_xxx", location: "Shop" })).toBe(true);
  });

  it("rejects a config missing secret_key", () => {
    expect(isStripeConnectionConfig({ location: "Shop" })).toBe(false);
  });

  it("rejects a config missing location", () => {
    expect(isStripeConnectionConfig({ secret_key: "rk_live_xxx" })).toBe(false);
  });

  it("rejects an empty secret_key", () => {
    expect(isStripeConnectionConfig({ secret_key: "", location: "Shop" })).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isStripeConnectionConfig(null)).toBe(false);
    expect(isStripeConnectionConfig("nope")).toBe(false);
  });
});
