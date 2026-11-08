import { existsSync, readFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pid } from "node:process";
import type { RepoPathSuggestion } from "@reviewflow/sdk";
import type { FoundCheckout } from "./config.ts";
import {
  checkCheckout,
  discoverCheckoutsUnder,
  readConfig,
  readDirectories,
} from "./config.ts";

/** `cache/repositories.json` beside `config.json`. */
export const repositoriesCachePathOf = (configPath: string): string =>
  join(dirname(configPath), "cache", "repositories.json");

interface RepositoriesCache {
  /** the expanded folders the scan read: another list is a cache miss */
  repoPaths: string[];
  scannedAt: string;
  checkouts: FoundCheckout[];
}

const isFoundCheckout = (value: unknown): value is FoundCheckout =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as FoundCheckout).ownerRepo === "string" &&
  typeof (value as FoundCheckout).path === "string";

const isRepositoriesCache = (value: unknown): value is RepositoriesCache => {
  if (typeof value !== "object" || value === null) return false;
  const cache = value as RepositoriesCache;
  return (
    Array.isArray(cache.repoPaths) &&
    cache.repoPaths.every((path) => typeof path === "string") &&
    typeof cache.scannedAt === "string" &&
    Array.isArray(cache.checkouts) &&
    cache.checkouts.every(isFoundCheckout)
  );
};

/** null when missing, unreadable or of another shape: a cache is rebuilt, never repaired. */
const readCache = (cachePath: string): RepositoriesCache | null => {
  try {
    const parsed: unknown = JSON.parse(readFileSync(cachePath, "utf8"));
    return isRepositoriesCache(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

/** Written whole then renamed, so a concurrent read never sees half a file. */
const writeCache = async (
  cachePath: string,
  cache: RepositoriesCache,
): Promise<void> => {
  const temporary = `${cachePath}.${String(pid)}.tmp`;
  try {
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(temporary, `${JSON.stringify(cache, null, 2)}\n`);
    await rename(temporary, cachePath);
  } catch (error) {
    // the scan's answer stands without its cache: the next listing scans again
    console.warn(`could not write ${cachePath}:`, error);
  }
};

const sameFolders = (left: string[], right: string[]): boolean =>
  left.length === right.length &&
  left.every((path, index) => path === right[index]);

/** Folder by folder: a repository found under an earlier folder hides its clones in later ones. */
const scanRepoPaths = async (repoPaths: string[]): Promise<FoundCheckout[]> => {
  const byRepo = new Map<string, FoundCheckout>();
  for (const base of repoPaths) {
    for (const checkout of await discoverCheckoutsUnder(base)) {
      const key = checkout.ownerRepo.toLowerCase();
      if (!byRepo.has(key)) byRepo.set(key, checkout);
    }
  }
  return [...byRepo.values()];
};

/**
 * The checkouts directly under `repoPaths`, from the cache when it was built
 * for these same folders; scanned again and cached otherwise, or on `refresh`.
 * A checkout cloned or moved since the scan shows only after a refresh.
 */
const readFoundCheckouts = async (
  configPath: string,
  repoPaths: string[],
  refresh: boolean,
): Promise<RepositoriesCache> => {
  const cachePath = repositoriesCachePathOf(configPath);
  const cached = refresh ? null : readCache(cachePath);
  if (cached !== null && sameFolders(cached.repoPaths, repoPaths)) {
    return cached;
  }
  const scanned: RepositoriesCache = {
    repoPaths,
    scannedAt: new Date().toISOString(),
    checkouts: await scanRepoPaths(repoPaths),
  };
  await writeCache(cachePath, scanned);
  return scanned;
};

export interface ListedCheckout {
  ownerRepo: string;
  path: string;
  /** false: found directly under one of `repoPaths` */
  configured: boolean;
}

export interface CheckoutListing {
  checkouts: ListedCheckout[];
  /** expanded */
  repoPaths: string[];
  scannedAt: string;
}

/**
 * Every checkout the app can show: the config's `repos`, then the checkouts
 * found directly under `repoPaths` whose repository the config does not name,
 * by `owner/repo`. A configured path is listed even when it is unusable, so
 * the list says what to fix.
 */
export const listCheckouts = async (
  configPath: string,
  { refresh = false }: { refresh?: boolean } = {},
): Promise<CheckoutListing> => {
  const config = readConfig(configPath);
  const configured = Object.entries(config.repos).map(([ownerRepo, path]) => ({
    ownerRepo,
    path,
    configured: true,
  }));
  const known = new Set(
    configured.map(({ ownerRepo }) => ownerRepo.toLowerCase()),
  );
  const found = await readFoundCheckouts(configPath, config.repoPaths, refresh);
  const discovered = found.checkouts
    .filter(({ ownerRepo }) => !known.has(ownerRepo.toLowerCase()))
    .map((checkout) => ({ ...checkout, configured: false }));
  return {
    checkouts: [...configured, ...discovered].toSorted((left, right) =>
      left.ownerRepo.localeCompare(right.ownerRepo),
    ),
    repoPaths: config.repoPaths,
    scannedAt: found.scannedAt,
  };
};

/**
 * The listed checkout of `ownerRepo`, usable; refused otherwise. A route that
 * reads a checkout takes it from here, never from the request: no route
 * authenticates, so one that read whatever path it was handed would read any
 * repository on the machine.
 */
export const resolveListedCheckout = async (
  configPath: string,
  ownerRepo: string,
): Promise<{ checkout: string } | { refused: string }> => {
  const wanted = ownerRepo.toLowerCase();
  const { checkouts } = await listCheckouts(configPath);
  const listed = checkouts.find(
    (checkout) => checkout.ownerRepo.toLowerCase() === wanted,
  );
  if (listed === undefined) {
    return {
      refused: `${ownerRepo} is neither configured nor a checkout found under repoPaths (refresh the list after a clone)`,
    };
  }
  const problem = await checkCheckout(listed.ownerRepo, listed.path);
  return problem === null ? { checkout: listed.path } : { refused: problem };
};

/**
 * The names a folder of checkouts usually has in the home directory, compared
 * case-insensitively. Documents, Desktop and Downloads are left out: reading
 * them makes macOS ask the user for access.
 */
const usualFolderNames = new Set([
  "code",
  "dev",
  "developer",
  "git",
  "github",
  "projects",
  "repos",
  "src",
  "work",
  "workspace",
]);

const asConfigPath = (path: string, home: string): string => {
  const inside = relative(home, path);
  return inside.startsWith("..")
    ? `${path}/`
    : `~/${inside.split(sep).join("/")}/`;
};

/**
 * A usual folder and, since checkouts are often grouped by owner or by
 * project (`~/dev/acme/widgets`), each of its subdirectories that is not
 * itself a checkout.
 */
const candidateFolders = async (home: string): Promise<string[]> => {
  const homeEntries = await readDirectories(home);
  const roots = homeEntries
    .filter((entry) => usualFolderNames.has(entry.name.toLowerCase()))
    .map((entry) => join(home, entry.name))
    .toSorted();
  const nested = await Promise.all(
    roots.map(async (root) => {
      const entries = await readDirectories(root);
      return entries
        .filter((entry) => !existsSync(join(root, entry.name, ".git")))
        .map((entry) => join(root, entry.name))
        .toSorted();
    }),
  );
  return roots.flatMap((root, index) => [root, ...(nested[index] ?? [])]);
};

const normalizeFolder = (path: string): string => resolve(path);

/**
 * The folders under `home` holding checkouts of GitHub repositories directly,
 * that `repoPaths` does not list: what the settings offer to add. Read on
 * demand only, folder after folder, so a large home does not start hundreds
 * of git processes at once.
 */
export const suggestRepoPaths = async ({
  home = homedir(),
  repoPaths,
}: {
  home?: string;
  /** expanded */
  repoPaths: string[];
}): Promise<RepoPathSuggestion[]> => {
  const listed = new Set(repoPaths.map(normalizeFolder));
  const suggestions: RepoPathSuggestion[] = [];
  for (const folder of await candidateFolders(home)) {
    if (listed.has(normalizeFolder(folder))) continue;
    const found = await discoverCheckoutsUnder(folder);
    if (found.length > 0) {
      suggestions.push({
        path: asConfigPath(folder, home),
        checkouts: found.length,
      });
    }
  }
  return suggestions;
};
