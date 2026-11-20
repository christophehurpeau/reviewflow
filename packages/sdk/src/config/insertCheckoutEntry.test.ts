import { describe, expect, it } from "vitest";
import { insertCheckoutEntry } from "./insertCheckoutEntry.ts";

describe("insertCheckoutEntry", () => {
  it("builds a config from a blank text, cursor between the quotes", () => {
    const result = insertCheckoutEntry("", "christophehurpeau/web");
    expect(result?.source).toBe(
      '{\n  "repos": {\n    "christophehurpeau/web": ""\n  }\n}\n',
    );
    expect(result?.source.slice(result.cursor - 1, result.cursor + 1)).toBe(
      '""',
    );
  });

  it("adds the entry after the existing ones and keeps other keys", () => {
    const result = insertCheckoutEntry(
      JSON.stringify({ repos: { "christophehurpeau/api": "/api" }, other: 1 }),
      "christophehurpeau/web",
    );
    expect(JSON.parse(result?.source ?? "{}")).toEqual({
      repos: { "christophehurpeau/api": "/api", "christophehurpeau/web": "" },
      other: 1,
    });
    expect(result?.source.slice(result.cursor - 1, result.cursor + 1)).toBe(
      '""',
    );
  });

  it("adds repos when the object has none", () => {
    expect(
      JSON.parse(
        insertCheckoutEntry("{}", "christophehurpeau/web")?.source ?? "{}",
      ),
    ).toEqual({ repos: { "christophehurpeau/web": "" } });
  });

  it("leaves an existing entry alone, case-insensitively, cursor in its value", () => {
    const result = insertCheckoutEntry(
      JSON.stringify({ repos: { "ChristopheHurpeau/Web": "/web" } }),
      "christophehurpeau/web",
    );
    expect(JSON.parse(result?.source ?? "{}")).toEqual({
      repos: { "ChristopheHurpeau/Web": "/web" },
    });
    expect(result?.source.slice(result.cursor)).toMatch(/^\/web"/);
  });

  it("puts the cursor in repos when another key holds the same name first", () => {
    const result = insertCheckoutEntry(
      JSON.stringify({ aliases: { "christophehurpeau/web": "x" }, repos: {} }),
      "christophehurpeau/web",
    );
    expect(result?.source.slice(0, result.cursor)).toMatch(
      /"repos": \{\n {4}"christophehurpeau\/web": "$/,
    );
  });

  it("does not guess at text that is not a config", () => {
    expect(insertCheckoutEntry("{", "christophehurpeau/web")).toBeNull();
    expect(insertCheckoutEntry("[]", "christophehurpeau/web")).toBeNull();
    expect(
      insertCheckoutEntry('{"repos": []}', "christophehurpeau/web"),
    ).toBeNull();
  });
});
