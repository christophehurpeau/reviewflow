import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { defaultRepoPaths } from "@reviewflow/sdk";
import {
  describeRepoAttachment,
  expandHome,
  findCheckoutUnder,
  ownerRepoOfRemote,
  readConfig,
  resolveCheckout,
  validateConfigSource,
} from "./config.ts";

let root: string;
let repo: string;
let reposBase: string;
let configPath: string;

const git = (cwd: string, ...args: string[]): void => {
  execFileSync("git", args, { cwd, stdio: "ignore" });
};

const createCheckout = (path: string, origin: string): void => {
  mkdirSync(path, { recursive: true });
  git(path, "init", "--quiet");
  git(path, "remote", "add", "origin", origin);
};

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "reviewflow-app-config-"));
  repo = join(root, "checkout");
  createCheckout(repo, "git@github.com:Acme/Widgets.git");
  reposBase = join(root, "dev");
  createCheckout(join(reposBase, "gizmos"), "git@github.com:acme/gizmos.git");
  createCheckout(
    join(reposBase, "fork", "gadgets"),
    "git@github.com:someone/gadgets.git",
  );
  createCheckout(
    join(reposBase, "perso", "gadgets"),
    "git@github.com:acme/gadgets.git",
  );
  configPath = join(root, "config.json");
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

const writeConfig = (repos: Record<string, string>): void => {
  writeFileSync(
    configPath,
    JSON.stringify({ repoPaths: [join(root, "empty"), reposBase], repos }),
  );
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

describe("expandHome", () => {
  test.each([
    ["~", homedir()],
    ["~/dev/widgets", join(homedir(), "dev/widgets")],
    ["/abs/~/x", "/abs/~/x"],
    ["~other/x", "~other/x"],
    ["relative", "relative"],
  ])("%s", (path, expected) => {
    expect(expandHome(path)).toBe(expected);
  });
});

describe("config", () => {
  test("reads paths under ~ expanded", () => {
    writeFileSync(
      configPath,
      JSON.stringify({
        repoPaths: ["~/code", "/work"],
        repos: { "acme/widgets": "~/dev/widgets" },
      }),
    );
    expect(readConfig(configPath)).toEqual({
      repoPaths: [join(homedir(), "code"), "/work"],
      repos: { "acme/widgets": join(homedir(), "dev/widgets") },
    });
  });

  test("repoPaths defaults to ~/dev/", () => {
    writeFileSync(configPath, JSON.stringify({ repos: {} }));
    expect(readConfig(configPath).repoPaths).toEqual([expandHome("~/dev/")]);
    expect(defaultRepoPaths).toEqual(["~/dev/"]);
  });

  test("reads the legacy defaultRepoPath as one folder", () => {
    writeFileSync(configPath, JSON.stringify({ defaultRepoPath: "~/code" }));
    expect(readConfig(configPath).repoPaths).toEqual([join(homedir(), "code")]);
  });

  test("an empty repoPaths searches no folder", async () => {
    writeFileSync(configPath, JSON.stringify({ repoPaths: [] }));
    expect(readConfig(configPath).repoPaths).toEqual([]);
    expect(await resolveCheckout(configPath, "acme/gizmos")).toMatchObject({
      refused: {
        reason: "notConfigured",
        detail: expect.stringContaining("no repositories folder"),
      },
    });
  });

  test("a repoPaths that is not a list of paths raises", () => {
    writeFileSync(configPath, JSON.stringify({ repoPaths: "~/dev" }));
    expect(() => readConfig(configPath)).toThrow("must be a list of paths");
  });

  test("a missing file is no repository, not an error", async () => {
    expect(readConfig(join(root, "nope.json")).repos).toEqual({});
    const refusal = await resolveCheckout(
      join(root, "nope.json"),
      "Acme/Widgets",
    );
    expect(refusal).toMatchObject({ refused: { reason: "notConfigured" } });
  });

  test("a malformed file raises", () => {
    writeFileSync(configPath, "{");
    expect(() => readConfig(configPath)).toThrow("not valid json");
  });

  test("finds a repo missing from the file under any of repoPaths", async () => {
    writeConfig({});
    expect(await resolveCheckout(configPath, "acme/gizmos")).toEqual({
      checkout: join(reposBase, "gizmos"),
    });
  });

  test("an explicit entry wins over repoPaths", async () => {
    writeConfig({ "acme/gizmos": join(root, "gone") });
    expect(await resolveCheckout(configPath, "acme/gizmos")).toMatchObject({
      refused: { reason: "invalidPath" },
    });
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

describe("findCheckoutUnder", () => {
  test("finds <base>/<repo>, case-insensitively", async () => {
    expect(await findCheckoutUnder(reposBase, "Acme/Gizmos")).toBe(
      join(reposBase, "gizmos"),
    );
  });

  test("finds <base>/<any>/<repo>, skipping one whose origin is another repo", async () => {
    expect(await findCheckoutUnder(reposBase, "acme/gadgets")).toBe(
      join(reposBase, "perso", "gadgets"),
    );
  });

  test("finds nothing for an unknown repo or a missing base", async () => {
    expect(await findCheckoutUnder(reposBase, "acme/other")).toBeNull();
    expect(
      await findCheckoutUnder(join(root, "gone"), "acme/gizmos"),
    ).toBeNull();
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
    [source({ "acme/widgets": "~other/dir" }), "must be an absolute path"],
    [
      '{"repos":{},"defaultRepoPath":3}',
      '"defaultRepoPath" must be a non-empty',
    ],
    [
      '{"repos":{},"defaultRepoPath":"dev"}',
      '"defaultRepoPath" must be an absolute',
    ],
    ['{"repos":{},"repoPaths":"~/dev"}', '"repoPaths" must be a list'],
    [
      '{"repos":{},"repoPaths":["~/dev", ""]}',
      "repoPaths[1] must be a non-empty",
    ],
    ['{"repos":{},"repoPaths":["dev"]}', "repoPaths[0] must be an absolute"],
    [
      '{"repos":{},"repoPaths":["~/dev"],"defaultRepoPath":"~/dev"}',
      'keep only "repoPaths"',
    ],
  ])("refuses %s", async (text, message) => {
    expect(await validateConfigSource(text)).toEqual({
      error: expect.stringContaining(message),
    });
  });

  test("accepts a path under ~, checked expanded", async () => {
    const missing = "~/reviewflow-app-config-test-missing";
    expect(
      await validateConfigSource(source({ "acme/widgets": missing })),
    ).toEqual({
      warnings: [
        `acme/widgets: ${expandHome(missing)} does not exist or is not a directory`,
      ],
    });
  });

  test("accepts repoPaths, warning for each folder that is not a directory", async () => {
    expect(
      await validateConfigSource(
        JSON.stringify({ repoPaths: [reposBase], repos: {} }),
      ),
    ).toEqual({ warnings: [] });
    expect(
      await validateConfigSource(
        JSON.stringify({
          repoPaths: [reposBase, join(root, "gone")],
          repos: {},
        }),
      ),
    ).toEqual({
      warnings: [
        `repoPaths[1]: ${join(root, "gone")} does not exist or is not a directory`,
      ],
    });
  });

  test("accepts the legacy defaultRepoPath, warning when it is not a directory", async () => {
    expect(
      await validateConfigSource(
        JSON.stringify({ defaultRepoPath: reposBase, repos: {} }),
      ),
    ).toEqual({ warnings: [] });
    expect(
      await validateConfigSource(
        JSON.stringify({ defaultRepoPath: join(root, "gone"), repos: {} }),
      ),
    ).toEqual({
      warnings: [
        `"defaultRepoPath": ${join(root, "gone")} does not exist or is not a directory`,
      ],
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
