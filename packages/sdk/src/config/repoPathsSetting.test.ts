import { describe, expect, it } from "vitest";
import {
  readRepoPathsSetting,
  writeRepoPathsSetting,
} from "./repoPathsSetting.ts";

describe("readRepoPathsSetting", () => {
  it("reads the configured folders", () => {
    expect(
      readRepoPathsSetting('{ "repoPaths": ["~/code/", "/work"] }'),
    ).toEqual(["~/code/", "/work"]);
    expect(readRepoPathsSetting('{ "repoPaths": [] }')).toEqual([]);
  });

  it("reads the legacy defaultRepoPath as one folder", () => {
    expect(readRepoPathsSetting('{ "defaultRepoPath": "~/code/" }')).toEqual([
      "~/code/",
    ]);
  });

  it("prefers repoPaths over the legacy key", () => {
    expect(
      readRepoPathsSetting(
        '{ "defaultRepoPath": "~/old/", "repoPaths": ["~/new/"] }',
      ),
    ).toEqual(["~/new/"]);
  });

  it("is undefined when unset, not json or not a list of strings", () => {
    expect(readRepoPathsSetting('{ "repos": {} }')).toBeUndefined();
    expect(readRepoPathsSetting("")).toBeUndefined();
    expect(readRepoPathsSetting("{")).toBeUndefined();
    expect(readRepoPathsSetting('{ "repoPaths": [1] }')).toBeUndefined();
    expect(readRepoPathsSetting('{ "defaultRepoPath": 1 }')).toBeUndefined();
  });
});

describe("writeRepoPathsSetting", () => {
  it("adds the key first and keeps the others", () => {
    expect(
      writeRepoPathsSetting(JSON.stringify({ repos: { "acme/web": "/web" } }), [
        " ~/code/ ",
      ]),
    ).toBe(
      '{\n  "repoPaths": [\n    "~/code/"\n  ],\n  "repos": {\n    "acme/web": "/web"\n  }\n}\n',
    );
  });

  it("replaces the legacy defaultRepoPath in place", () => {
    const source = writeRepoPathsSetting(
      JSON.stringify({ repos: {}, defaultRepoPath: "~/dev/", other: 1 }),
      ["~/dev/", "/src"],
    );
    expect(Object.entries(JSON.parse(source ?? "{}"))).toEqual([
      ["repos", {}],
      ["repoPaths", ["~/dev/", "/src"]],
      ["other", 1],
    ]);
  });

  it("drops blanks and duplicates, and keeps an empty list", () => {
    expect(
      JSON.parse(
        writeRepoPathsSetting('{ "repoPaths": ["~/a/"] }', [
          "/x",
          " ",
          "/x ",
        ]) ?? "",
      ),
    ).toEqual({ repoPaths: ["/x"] });
    expect(
      JSON.parse(writeRepoPathsSetting('{ "repoPaths": ["~/a/"] }', []) ?? ""),
    ).toEqual({ repoPaths: [] });
  });

  it("builds a config from a blank text", () => {
    expect(writeRepoPathsSetting("", ["~/code/"])).toBe(
      '{\n  "repoPaths": [\n    "~/code/"\n  ]\n}\n',
    );
  });

  it("refuses a text that is not a json object", () => {
    expect(writeRepoPathsSetting("[]", ["~/code/"])).toBeNull();
    expect(writeRepoPathsSetting("{", ["~/code/"])).toBeNull();
  });
});
