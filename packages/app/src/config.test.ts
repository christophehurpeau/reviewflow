import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  describeRepoAttachment,
  ownerRepoOfRemote,
  readConfigRepos,
  resolveCheckout,
  validateConfigSource,
} from "./config.ts";

let root: string;
let repo: string;
let configPath: string;

const git = (cwd: string, ...args: string[]): void => {
  execFileSync("git", args, { cwd, stdio: "ignore" });
};

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "reviewflow-app-config-"));
  repo = join(root, "checkout");
  mkdirSync(repo);
  git(repo, "init", "--quiet");
  git(repo, "remote", "add", "origin", "git@github.com:Acme/Widgets.git");
  configPath = join(root, "config.json");
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

const writeConfig = (repos: Record<string, string>): void => {
  writeFileSync(configPath, JSON.stringify({ repos }));
};

describe("ownerRepoOfRemote", () => {
  test.each([
    ["git@github.com:o/r.git", "o/r"],
    ["git@github.com:o/r", "o/r"],
    ["ssh://git@github.com/o/r.git", "o/r"],
    ["https://github.com/o/r", "o/r"],
    ["https://github.com/o/r.git", "o/r"],
    ["https://user:tok@github.com/o/r.git/", "o/r"],
    ["https://www.github.com/o/r", "o/r"],
  ])("%s", (url, expected) => {
    expect(ownerRepoOfRemote(url)).toBe(expected);
  });

  test("not a github remote", () => {
    expect(ownerRepoOfRemote("git@gitlab.com:o/r.git")).toBeNull();
    expect(ownerRepoOfRemote("/some/path")).toBeNull();
  });
});

describe("config", () => {
  test("a missing file is no repository, not an error", async () => {
    expect(readConfigRepos(join(root, "nope.json"))).toEqual({});
    const refusal = await resolveCheckout(
      join(root, "nope.json"),
      "Acme/Widgets",
    );
    expect(refusal).toMatchObject({ refused: { reason: "notConfigured" } });
  });

  test("a malformed file raises", () => {
    writeFileSync(configPath, "{");
    expect(() => readConfigRepos(configPath)).toThrow("not valid json");
  });

  test("resolves a checkout whose origin names the repo, case-insensitively", async () => {
    writeConfig({ "acme/widgets": repo });
    expect(await resolveCheckout(configPath, "Acme/Widgets")).toEqual({
      checkout: repo,
    });
  });

  test("refuses a repo missing from the file", async () => {
    writeConfig({ "acme/widgets": repo });
    expect(await resolveCheckout(configPath, "acme/other")).toEqual({
      refused: {
        reason: "notConfigured",
        ownerRepo: "acme/other",
        configPath,
        detail: expect.any(String),
      },
    });
  });

  test("refuses a path that does not exist", async () => {
    writeConfig({ "acme/widgets": join(root, "gone") });
    expect(await resolveCheckout(configPath, "acme/widgets")).toMatchObject({
      refused: { reason: "invalidPath" },
    });
  });

  test("refuses a checkout whose origin names another repo", async () => {
    writeConfig({ "acme/gadgets": repo });
    const answer = await resolveCheckout(configPath, "acme/gadgets");
    expect(answer).toMatchObject({ refused: { reason: "invalidPath" } });
    expect(JSON.stringify(answer)).toContain("does not name acme/gadgets");
  });

  test("describeRepoAttachment answers a state for each case", async () => {
    writeConfig({ "acme/widgets": repo, "acme/gadgets": repo });
    expect(await describeRepoAttachment(configPath, "acme/widgets")).toEqual({
      ownerRepo: "acme/widgets",
      status: "attached",
      detail: repo,
    });
    expect(
      await describeRepoAttachment(configPath, "acme/gadgets"),
    ).toMatchObject({
      status: "invalidPath",
      detail: expect.stringContaining("does not name"),
    });
    expect(
      await describeRepoAttachment(configPath, "acme/other"),
    ).toMatchObject({ status: "notConfigured" });
  });

  test("describeRepoAttachment reports an unreadable file as not configured", async () => {
    writeFileSync(configPath, "{");
    expect(
      await describeRepoAttachment(configPath, "acme/widgets"),
    ).toMatchObject({
      status: "notConfigured",
      detail: expect.stringContaining("not valid json"),
    });
  });
});

describe("validateConfigSource", () => {
  const source = (repos: unknown): string => JSON.stringify({ repos });

  test("accepts a valid checkout without warnings", async () => {
    expect(
      await validateConfigSource(source({ "acme/widgets": repo })),
    ).toEqual({
      warnings: [],
    });
  });

  test("accepts no repository at all", async () => {
    expect(await validateConfigSource(source({}))).toEqual({ warnings: [] });
  });

  test.each([
    ["{", "not valid json"],
    ["[]", "must be a json object"],
    ["null", "must be a json object"],
    ['{"repo":{}}', 'unknown key "repo"'],
    ["{}", '"repos" must be an object'],
    ['{"repos":[]}', '"repos" must be an object'],
    [source({ widgets: "/x" }), 'repos key "widgets" must be owner/repo'],
    [
      source({ "acme/widgets": 3 }),
      'repos["acme/widgets"] must be the absolute path',
    ],
    [source({ "acme/widgets": "" }), "non-empty string"],
    [source({ "acme/widgets": "relative/dir" }), "must be an absolute path"],
  ])("refuses %s", async (text, message) => {
    expect(await validateConfigSource(text)).toEqual({
      error: expect.stringContaining(message),
    });
  });

  test("warns, and does not refuse, for a missing or mismatching checkout", async () => {
    const result = await validateConfigSource(
      source({
        "acme/widgets": repo,
        "acme/gone": join(root, "gone"),
        "acme/gadgets": repo,
      }),
    );
    expect(result).toEqual({
      warnings: [
        expect.stringContaining("acme/gone: "),
        expect.stringContaining("acme/gadgets: "),
      ],
    });
    expect((result as { warnings: string[] }).warnings[0]).toContain(
      "does not exist",
    );
  });
});
