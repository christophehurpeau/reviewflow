import { describe, expect, it } from "vitest";
import {
  readDefaultRepoPathSetting,
  writeDefaultRepoPathSetting,
} from "./defaultRepoPathSetting.ts";

describe("readDefaultRepoPathSetting", () => {
  it("reads the configured path", () => {
    expect(readDefaultRepoPathSetting('{ "defaultRepoPath": "~/code/" }')).toBe(
      "~/code/",
    );
  });

  it("is undefined when unset, blank, not json or not a string", () => {
    expect(readDefaultRepoPathSetting('{ "repos": {} }')).toBeUndefined();
    expect(readDefaultRepoPathSetting("")).toBeUndefined();
    expect(readDefaultRepoPathSetting("{")).toBeUndefined();
    expect(
      readDefaultRepoPathSetting('{ "defaultRepoPath": 1 }'),
    ).toBeUndefined();
  });
});

describe("writeDefaultRepoPathSetting", () => {
  it("adds the key first and keeps the others", () => {
    expect(
      writeDefaultRepoPathSetting(
        JSON.stringify({ repos: { "acme/web": "/web" } }),
        " ~/code/ ",
      ),
    ).toBe(
      '{\n  "defaultRepoPath": "~/code/",\n  "repos": {\n    "acme/web": "/web"\n  }\n}\n',
    );
  });

  it("replaces an existing value in place", () => {
    const source = writeDefaultRepoPathSetting(
      JSON.stringify({ repos: {}, defaultRepoPath: "~/dev/" }),
      "/src",
    );
    expect(Object.entries(JSON.parse(source ?? "{}"))).toEqual([
      ["repos", {}],
      ["defaultRepoPath", "/src"],
    ]);
  });

  it("removes the key on a blank path", () => {
    expect(
      writeDefaultRepoPathSetting(
        JSON.stringify({ defaultRepoPath: "~/code/", repos: {} }),
        "  ",
      ),
    ).toBe('{\n  "repos": {}\n}\n');
  });

  it("builds a config from a blank text", () => {
    expect(writeDefaultRepoPathSetting("", "~/code/")).toBe(
      '{\n  "defaultRepoPath": "~/code/"\n}\n',
    );
  });

  it("refuses a text that is not a json object", () => {
    expect(writeDefaultRepoPathSetting("[]", "~/code/")).toBeNull();
    expect(writeDefaultRepoPathSetting("{", "~/code/")).toBeNull();
  });
});
