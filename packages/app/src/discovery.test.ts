import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  listCheckouts,
  repositoriesCachePathOf,
  resolveListedCheckout,
  suggestRepoPaths,
} from "./discovery.ts";

let root: string;
let configPath: string;
let work: string;
let perso: string;

const createCheckout = (path: string, origin: string): void => {
  mkdirSync(path, { recursive: true });
  execFileSync("git", ["init", "--quiet"], { cwd: path });
  execFileSync("git", ["remote", "add", "origin", origin], { cwd: path });
};

const writeConfig = (config: object): void => {
  writeFileSync(configPath, JSON.stringify(config));
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "reviewflow-app-discovery-"));
  configPath = join(root, "home", "config.json");
  mkdirSync(join(root, "home"));
  work = join(root, "dev", "work");
  perso = join(root, "dev", "perso");
  createCheckout(join(work, "widgets"), "git@github.com:acme/widgets.git");
  createCheckout(join(perso, "widgets"), "git@github.com:acme/widgets.git");
  createCheckout(join(perso, "gizmos"), "git@github.com:me/gizmos.git");
  mkdirSync(join(perso, "notes"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("listCheckouts", () => {
  test("lists the checkouts of every folder, an earlier folder winning a repository", async () => {
    writeConfig({ repoPaths: [work, perso] });
    const listing = await listCheckouts(configPath);
    expect(listing.repoPaths).toEqual([work, perso]);
    expect(listing.checkouts).toEqual([
      {
        ownerRepo: "acme/widgets",
        path: join(work, "widgets"),
        configured: false,
      },
      {
        ownerRepo: "me/gizmos",
        path: join(perso, "gizmos"),
        configured: false,
      },
    ]);
  });

  test("caches the scan beside the config, until a refresh", async () => {
    writeConfig({ repoPaths: [perso] });
    const first = await listCheckouts(configPath);
    const cachePath = repositoriesCachePathOf(configPath);
    expect(cachePath).toBe(join(root, "home", "cache", "repositories.json"));
    expect(JSON.parse(readFileSync(cachePath, "utf8"))).toMatchObject({
      repoPaths: [perso],
      scannedAt: first.scannedAt,
    });

    createCheckout(join(perso, "gadgets"), "git@github.com:me/gadgets.git");
    const cached = await listCheckouts(configPath);
    expect(cached.scannedAt).toBe(first.scannedAt);
    expect(cached.checkouts.map(({ ownerRepo }) => ownerRepo)).not.toContain(
      "me/gadgets",
    );
    expect(await resolveListedCheckout(configPath, "me/gadgets")).toEqual({
      refused: expect.stringContaining("refresh the list"),
    });

    const refreshed = await listCheckouts(configPath, { refresh: true });
    expect(refreshed.checkouts.map(({ ownerRepo }) => ownerRepo)).toContain(
      "me/gadgets",
    );
  });

  test("scans again when the folders change", async () => {
    writeConfig({ repoPaths: [perso] });
    await listCheckouts(configPath);
    writeConfig({ repoPaths: [work] });
    const listing = await listCheckouts(configPath);
    expect(listing.checkouts).toEqual([
      {
        ownerRepo: "acme/widgets",
        path: join(work, "widgets"),
        configured: false,
      },
    ]);
  });

  test("ignores a cache it cannot read", async () => {
    writeConfig({ repoPaths: [perso] });
    mkdirSync(join(root, "home", "cache"));
    writeFileSync(repositoriesCachePathOf(configPath), "{");
    const { checkouts } = await listCheckouts(configPath);
    expect(checkouts).toHaveLength(2);
  });

  test("a configured entry hides the found clone of its repository", async () => {
    writeConfig({
      repoPaths: [perso],
      repos: { "acme/widgets": join(work, "widgets") },
    });
    const { checkouts } = await listCheckouts(configPath);
    expect(checkouts).toEqual([
      {
        ownerRepo: "acme/widgets",
        path: join(work, "widgets"),
        configured: true,
      },
      {
        ownerRepo: "me/gizmos",
        path: join(perso, "gizmos"),
        configured: false,
      },
    ]);
  });
});

describe("suggestRepoPaths", () => {
  test("offers the usual folders and their groupings that hold checkouts, minus the listed ones", async () => {
    createCheckout(join(root, "code", "tool"), "https://github.com/me/tool");
    mkdirSync(join(root, "Downloads", "x"), { recursive: true });
    createCheckout(
      join(root, "Downloads", "x", "y"),
      "https://github.com/me/y",
    );
    expect(
      await suggestRepoPaths({ home: root, repoPaths: [`${work}/`] }),
    ).toEqual([
      { path: "~/code/", checkouts: 1 },
      { path: "~/dev/perso/", checkouts: 2 },
    ]);
  });

  test("offers nothing for a home without usual folders", async () => {
    const empty = join(root, "empty");
    mkdirSync(empty);
    expect(await suggestRepoPaths({ home: empty, repoPaths: [] })).toEqual([]);
    expect(existsSync(join(empty, "cache"))).toBe(false);
  });
});
