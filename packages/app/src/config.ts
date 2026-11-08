import { execFile } from "node:child_process";
import type { Dirent } from "node:fs";
import { existsSync, readFileSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { env } from "node:process";
import { promisify } from "node:util";
import type { DiffRefusal } from "@reviewflow/sdk";
import { defaultRepoPaths } from "@reviewflow/sdk";
import type { FileValidation } from "@reviewflow/sdk/files";

const execFileAsync = promisify(execFile);

export const configHome = (): string => {
  const override = env.REVIEWFLOW_APP_HOME;
  return override === undefined || override === ""
    ? join(homedir(), ".reviewflow-app")
    : override;
};

export const configPathOf = (home: string = configHome()): string =>
  join(home, "config.json");

const homePrefix = /^~(?=$|[/\\])/;

/** `~` and `~/…` resolved against the user's home; `~user/…` is left as is. */
export const expandHome = (path: string): string =>
  path.replace(homePrefix, () => homedir());

export interface AppConfig {
  /** `owner/repo` to its checkout, expanded */
  repos: Record<string, string>;
  /** the directories a repository missing from `repos` is searched in, in order, expanded */
  repoPaths: string[];
}

const readRepos = (
  configPath: string,
  repos: unknown,
): Record<string, string> => {
  if (repos === undefined) return {};
  if (typeof repos !== "object" || repos === null || Array.isArray(repos)) {
    throw new TypeError(`${configPath}: "repos" must be an object`);
  }
  const result: Record<string, string> = {};
  for (const [ownerRepo, path] of Object.entries(repos)) {
    if (typeof path !== "string") {
      throw new TypeError(
        `${configPath}: repos["${ownerRepo}"] must be a path`,
      );
    }
    result[ownerRepo] = expandHome(path);
  }
  return result;
};

const builtInRepoPaths = (): string[] => defaultRepoPaths.map(expandHome);

/** `repoPaths`, else the legacy `defaultRepoPath` as one folder, else the built-in default. */
const readRepoPaths = (
  configPath: string,
  object: { repoPaths?: unknown; defaultRepoPath?: unknown },
): string[] => {
  const { repoPaths, defaultRepoPath } = object;
  if (repoPaths !== undefined) {
    if (
      !Array.isArray(repoPaths) ||
      !repoPaths.every((path) => typeof path === "string")
    ) {
      throw new TypeError(`${configPath}: "repoPaths" must be a list of paths`);
    }
    return repoPaths.map(expandHome);
  }
  if (defaultRepoPath === undefined) return builtInRepoPaths();
  if (typeof defaultRepoPath !== "string") {
    throw new TypeError(`${configPath}: "defaultRepoPath" must be a path`);
  }
  return [expandHome(defaultRepoPath)];
};

/**
 * `{ "repoPaths": ["~/dev/"], "repos": { "owner/repo": "/absolute/path" } }`,
 * paths under `~/` returned expanded; the legacy `"defaultRepoPath": "~/dev/"`
 * reads as a one-folder `repoPaths`. A missing file means no repository is
 * configured, which is a state and not an error; an unreadable or malformed
 * file raises, so the user sees why nothing resolves.
 */
export const readConfig = (configPath: string): AppConfig => {
  if (!existsSync(configPath)) {
    return { repos: {}, repoPaths: builtInRepoPaths() };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(
      `${configPath} is not valid json: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  const object =
    typeof parsed === "object" && parsed !== null
      ? (parsed as {
          repos?: unknown;
          repoPaths?: unknown;
          defaultRepoPath?: unknown;
        })
      : {};
  return {
    repos: readRepos(configPath, object.repos),
    repoPaths: readRepoPaths(configPath, object),
  };
};

/**
 * The `owner/repo` a remote url names: `git@github.com:o/r(.git)`,
 * `ssh://git@github.com/o/r`, `https://github.com/o/r(.git)`, with or without
 * credentials, a trailing slash or a `www.`.
 */
export const ownerRepoOfRemote = (url: string): string | null => {
  const match =
    /^(?:[\w+.-]+:\/\/)?(?:[^@/]+@)?(?:www\.)?github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i.exec(
      url.trim(),
    );
  return match === null ? null : `${match[1]}/${match[2]}`;
};

const readOriginUrl = async (path: string): Promise<string | null> => {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", path, "config", "--get", "remote.origin.url"],
      { timeout: 10_000 },
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
};

/** Why a configured path cannot be used, or null when it can. */
export const checkCheckout = async (
  ownerRepo: string,
  path: string,
): Promise<string | null> => {
  let isDirectory = false;
  try {
    isDirectory = statSync(path).isDirectory();
  } catch {
    // reported below
  }
  if (!isDirectory) return `${path} does not exist or is not a directory`;

  const url = await readOriginUrl(path);
  if (url === null) {
    return `${path} has no remote.origin.url (is it a git checkout?)`;
  }
  const named = ownerRepoOfRemote(url);
  if (named === null || named.toLowerCase() !== ownerRepo.toLowerCase()) {
    return `remote.origin.url of ${path} is ${url}, which does not name ${ownerRepo}`;
  }
  return null;
};

export type ResolvedCheckout = { checkout: string } | { refused: DiffRefusal };

/** Case-insensitive lookup: GitHub names are. */
const findPath = (
  repos: Record<string, string>,
  ownerRepo: string,
): string | null => {
  const wanted = ownerRepo.toLowerCase();
  const key = Object.keys(repos).find((name) => name.toLowerCase() === wanted);
  return key === undefined ? null : (repos[key] ?? null);
};

export const readDirectories = async (path: string): Promise<Dirent[]> => {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.filter(
      (entry) => entry.isDirectory() || entry.isSymbolicLink(),
    );
  } catch {
    return [];
  }
};

const isNamed = (entry: Dirent, name: string): boolean =>
  entry.name.toLowerCase() === name.toLowerCase();

/**
 * `<base>/<repo>`, then `<base>/<owner>/<repo>`, then `<base>/<any>/<repo>`:
 * the layouts a directory of checkouts is kept in, by owner or by any grouping.
 */
const candidateCheckouts = async (
  base: string,
  ownerRepo: string,
): Promise<string[]> => {
  const [owner = "", repo = ""] = ownerRepo.split("/");
  const entries = await readDirectories(base);
  const direct = entries
    .filter((entry) => isNamed(entry, repo))
    .map((entry) => join(base, entry.name));
  const groupings = entries.toSorted(
    (left, right) =>
      Number(!isNamed(left, owner)) - Number(!isNamed(right, owner)),
  );
  const nested = await Promise.all(
    groupings.map(async (grouping) => {
      const children = await readDirectories(join(base, grouping.name));
      return children
        .filter((entry) => isNamed(entry, repo))
        .map((entry) => join(base, grouping.name, entry.name));
    }),
  );
  return [...direct, ...nested.flat()];
};

/** The first checkout under `base` whose origin remote names `ownerRepo`. */
export const findCheckoutUnder = async (
  base: string,
  ownerRepo: string,
): Promise<string | null> => {
  for (const candidate of await candidateCheckouts(base, ownerRepo)) {
    if ((await checkCheckout(ownerRepo, candidate)) === null) return candidate;
  }
  return null;
};

const findCheckoutUnderAny = async (
  bases: string[],
  ownerRepo: string,
): Promise<string | null> => {
  for (const base of bases) {
    const found = await findCheckoutUnder(base, ownerRepo);
    if (found !== null) return found;
  }
  return null;
};

const describeRepoPaths = (repoPaths: string[]): string =>
  repoPaths.length === 0 ? "no repositories folder" : repoPaths.join(", ");

/**
 * The checkout `repos` names for `ownerRepo`; without one, the first found
 * under `repoPaths`, folder by folder (see `findCheckoutUnder`).
 */
export const resolveCheckout = async (
  configPath: string,
  ownerRepo: string,
): Promise<ResolvedCheckout> => {
  const config = readConfig(configPath);
  const path = findPath(config.repos, ownerRepo);
  if (path === null) {
    const found = await findCheckoutUnderAny(config.repoPaths, ownerRepo);
    if (found !== null) return { checkout: found };
    return {
      refused: {
        reason: "notConfigured",
        ownerRepo,
        configPath,
        detail: `no checkout is configured for ${ownerRepo}, and none whose origin is ${ownerRepo} was found under ${describeRepoPaths(config.repoPaths)}`,
      },
    };
  }
  const problem = await checkCheckout(ownerRepo, path);
  if (problem !== null) {
    return {
      refused: {
        reason: "invalidPath",
        ownerRepo,
        configPath,
        detail: problem,
      },
    };
  }
  return { checkout: path };
};

/** `owner/repo` of a directory's origin; null when it is no checkout of a GitHub repository. */
const ownerRepoOfDirectory = async (path: string): Promise<string | null> => {
  // a directory without `.git` costs no git process: most of a folder's entries are no checkout
  if (!existsSync(join(path, ".git"))) return null;
  const url = await readOriginUrl(path);
  return url === null ? null : ownerRepoOfRemote(url);
};

export interface FoundCheckout {
  ownerRepo: string;
  path: string;
}

/**
 * The checkouts directly under `base`, one per repository: a directory named
 * after its repository before any other clone of it, then the first by name.
 * Only the first level is read, so a directory of checkouts costs one git
 * call per checkout and nothing deeper.
 */
export const discoverCheckoutsUnder = async (
  base: string,
): Promise<FoundCheckout[]> => {
  const directories = await readDirectories(base);
  const entries = directories.toSorted((left, right) =>
    left.name.localeCompare(right.name),
  );
  const found = await Promise.all(
    entries.map(async (entry) => {
      const path = join(base, entry.name);
      const ownerRepo = await ownerRepoOfDirectory(path);
      return ownerRepo === null ? null : { ownerRepo, path, name: entry.name };
    }),
  );
  const byRepo = new Map<string, FoundCheckout>();
  for (const checkout of found) {
    if (checkout === null) continue;
    const key = checkout.ownerRepo.toLowerCase();
    const repoName = checkout.ownerRepo.split("/")[1] ?? "";
    const named = checkout.name.toLowerCase() === repoName.toLowerCase();
    if (!byRepo.has(key) || named) {
      byRepo.set(key, { ownerRepo: checkout.ownerRepo, path: checkout.path });
    }
  }
  return [...byRepo.values()];
};

export type RepoAttachmentStatus = "attached" | "invalidPath" | "notConfigured";

export interface RepoAttachment {
  ownerRepo: string;
  status: RepoAttachmentStatus;
  /** the checkout in use, or why none can be */
  detail: string;
}

/**
 * Whether `ownerRepo` has a checkout a diff can be read from, with the same
 * checks `resolveCheckout` makes, but answered as a state: a config file that
 * cannot be read means no repository is attached, said in `detail`, rather
 * than a failure.
 */
export const describeRepoAttachment = async (
  configPath: string,
  ownerRepo: string,
): Promise<RepoAttachment> => {
  let resolved: ResolvedCheckout;
  try {
    resolved = await resolveCheckout(configPath, ownerRepo);
  } catch (error) {
    return {
      ownerRepo,
      status: "notConfigured",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
  if ("refused" in resolved) {
    return {
      ownerRepo,
      status: resolved.refused.reason,
      detail: resolved.refused.detail,
    };
  }
  return { ownerRepo, status: "attached", detail: resolved.checkout };
};

const ownerRepoPattern = /^[^/\s]+\/[^/\s]+$/;

const configKeys = new Set(["repoPaths", "defaultRepoPath", "repos"]);

type FolderCheck = { error: string } | { warning: string | null };

const validateFolder = (label: string, path: unknown): FolderCheck => {
  if (typeof path !== "string" || path.trim() === "") {
    return { error: `${label} must be a non-empty string` };
  }
  const expanded = expandHome(path);
  if (!isAbsolute(expanded)) {
    return {
      error: `${label} must be an absolute path or start with "~/", got "${path}"`,
    };
  }
  let isDirectory = false;
  try {
    isDirectory = statSync(expanded).isDirectory();
  } catch {
    // warned below
  }
  return {
    warning: isDirectory
      ? null
      : `${label}: ${expanded} does not exist or is not a directory`,
  };
};

/** The warnings of `repoPaths` (or the legacy `defaultRepoPath`), or the error refusing them. */
const validateRepoPaths = (
  object: Record<string, unknown>,
): { error: string } | { warnings: string[] } => {
  if ("repoPaths" in object && "defaultRepoPath" in object) {
    return {
      error:
        '"defaultRepoPath" is the former one-folder form of "repoPaths": keep only "repoPaths"',
    };
  }
  const { repoPaths } = object;
  const checks = ((): FolderCheck[] => {
    if ("defaultRepoPath" in object) {
      return [validateFolder('"defaultRepoPath"', object.defaultRepoPath)];
    }
    if (repoPaths === undefined) return [];
    if (!Array.isArray(repoPaths)) {
      return [{ error: '"repoPaths" must be a list of folders' }];
    }
    return repoPaths.map((path, index) =>
      validateFolder(`repoPaths[${String(index)}]`, path),
    );
  })();
  const refused = checks.find((check) => "error" in check);
  if (refused !== undefined) return refused;
  return {
    warnings: checks
      .map((check) => ("warning" in check ? check.warning : null))
      .filter((warning): warning is string => warning !== null),
  };
};

/**
 * What a save of the config file is checked with. Refused, nothing written:
 * text that is not json, anything but
 * `{ "repoPaths": ["~/dev/"], "repos": { "owner/repo": "/absolute/path" } }`
 * (paths absolute or `"~/path"`; `repoPaths` optional, or the legacy
 * `"defaultRepoPath": "~/dev/"` instead, never both) (an unknown key is
 * refused too, so a typo like "repo" is caught rather than ignored). Only
 * warned, the file is saved: a path that is not a git checkout, or whose
 * origin names another repository, or a folder of `repoPaths` that is not a
 * directory, since it may be on a disk that is not mounted yet.
 */
export const validateConfigSource = async (
  source: string,
): Promise<FileValidation> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    return {
      error: `not valid json: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { error: 'the file must be a json object: { "repos": { ... } }' };
  }
  const object = parsed as Record<string, unknown>;
  const unknownKey = Object.keys(object).find((key) => !configKeys.has(key));
  if (unknownKey !== undefined) {
    return {
      error: `unknown key "${unknownKey}": the keys are "repoPaths" and "repos"`,
    };
  }
  const repoPathsCheck = validateRepoPaths(object);
  if ("error" in repoPathsCheck) return repoPathsCheck;
  const repos = object.repos;
  if (typeof repos !== "object" || repos === null || Array.isArray(repos)) {
    return {
      error:
        '"repos" must be an object of "owner/repo": "/absolute/path/to/checkout"',
    };
  }
  const entries = Object.entries(repos);
  for (const [ownerRepo, path] of entries) {
    if (!ownerRepoPattern.test(ownerRepo)) {
      return {
        error: `repos key "${ownerRepo}" must be owner/repo`,
      };
    }
    if (typeof path !== "string" || path.trim() === "") {
      return {
        error: `repos["${ownerRepo}"] must be the absolute path of a checkout, as a non-empty string`,
      };
    }
    if (!isAbsolute(expandHome(path))) {
      return {
        error: `repos["${ownerRepo}"] must be an absolute path or start with "~/", got "${path}"`,
      };
    }
  }
  const problems = await Promise.all(
    entries.map(async ([ownerRepo, path]) => {
      const reason = await checkCheckout(ownerRepo, expandHome(path as string));
      return reason === null ? null : `${ownerRepo}: ${reason}`;
    }),
  );
  return {
    warnings: [...repoPathsCheck.warnings, ...problems].filter(
      (problem): problem is string => problem !== null,
    ),
  };
};

export const credentialsPath = (home: string = configHome()): string =>
  join(home, "credentials.json");
