import { describe, expect, it } from "vitest";
import { isPostgresConnectionConfig } from "./postgresSync";

describe("isPostgresConnectionConfig", () => {
  it("accepts a well-formed config", () => {
    expect(
      isPostgresConnectionConfig({
        connection_string: "postgres://user:pass@host:5432/db?sslmode=require",
        query: "select * from pos_totals where till_date = $1",
      })
    ).toBe(true);
  });

  it("rejects a config missing connection_string", () => {
    expect(isPostgresConnectionConfig({ query: "select 1" })).toBe(false);
  });

  it("rejects a config missing query", () => {
    expect(isPostgresConnectionConfig({ connection_string: "postgres://x" })).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isPostgresConnectionConfig(null)).toBe(false);
  });
});
