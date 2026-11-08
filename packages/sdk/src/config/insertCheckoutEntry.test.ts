import { describe, expect, it } from "vitest";
import { insertCheckoutEntry } from "./insertCheckoutEntry.ts";

describe("insertCheckoutEntry", () => {
  it("builds a config from a blank text, cursor between the quotes", () => {
    const result = insertCheckoutEntry("", "acme/web");
    expect(result?.source).toBe(
      '{\n  "repos": {\n    "acme/web": ""\n  }\n}\n',
    );
    expect(result?.source.slice(result.cursor - 1, result.cursor + 1)).toBe(
      '""',
    );
  });

  it("adds the entry after the existing ones and keeps other keys", () => {
    const result = insertCheckoutEntry(
      JSON.stringify({ repos: { "acme/api": "/api" }, other: 1 }),
      "acme/web",
    );
    expect(JSON.parse(result?.source ?? "{}")).toEqual({
      repos: { "acme/api": "/api", "acme/web": "" },
      other: 1,
    });
    expect(result?.source.slice(result.cursor - 1, result.cursor + 1)).toBe(
      '""',
    );
  });

  it("adds repos when the object has none", () => {
    expect(
      JSON.parse(insertCheckoutEntry("{}", "acme/web")?.source ?? "{}"),
    ).toEqual({ repos: { "acme/web": "" } });
  });

  it("leaves an existing entry alone, case-insensitively, cursor in its value", () => {
    const result = insertCheckoutEntry(
      JSON.stringify({ repos: { "Acme/Web": "/web" } }),
      "acme/web",
    );
    expect(JSON.parse(result?.source ?? "{}")).toEqual({
      repos: { "Acme/Web": "/web" },
    });
    expect(result?.source.slice(result.cursor)).toMatch(/^\/web"/);
  });

  it("puts the cursor in repos when another key holds the same name first", () => {
    const result = insertCheckoutEntry(
      JSON.stringify({ aliases: { "acme/web": "x" }, repos: {} }),
      "acme/web",
    );
    expect(result?.source.slice(0, result.cursor)).toMatch(
      /"repos": \{\n {4}"acme\/web": "$/,
    );
  });

  it("does not guess at text that is not a config", () => {
    expect(insertCheckoutEntry("{", "acme/web")).toBeNull();
    expect(insertCheckoutEntry("[]", "acme/web")).toBeNull();
    expect(insertCheckoutEntry('{"repos": []}', "acme/web")).toBeNull();
  });
});
