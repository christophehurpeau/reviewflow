import { execFile } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { env } from "node:process";
import { promisify } from "node:util";
import type { DiffRefusal } from "@reviewflow/sdk";
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

/**
 * `{ "repos": { "owner/repo": "/absolute/path" } }`, paths under `~/`
 * returned expanded. A missing file means no
 * repository is configured, which is a state and not an error; an unreadable
 * or malformed file raises, so the user sees why nothing resolves.
 */
export const readConfigRepos = (configPath: string): Record<string, string> => {
  if (!existsSync(configPath)) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(
      `${configPath} is not valid json: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  const repos =
    typeof parsed === "object" && parsed !== null
      ? (parsed as { repos?: unknown }).repos
      : undefined;
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

export const resolveCheckout = async (
  configPath: string,
  ownerRepo: string,
): Promise<ResolvedCheckout> => {
  const path = findPath(readConfigRepos(configPath), ownerRepo);
  if (path === null) {
    return {
      refused: {
        reason: "notConfigured",
        ownerRepo,
        configPath,
        detail: `no checkout is configured for ${ownerRepo}`,
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

/**
 * What a save of the config file is checked with. Refused, nothing written:
 * text that is not json, anything but `{ "repos": { "owner/repo": "/absolute/path" } }`
 * (or `"~/path"`)
 * (an unknown key is refused too, so a typo like "repo" is caught rather than
 * ignored). Only warned, the file is saved: a path that is not a git checkout,
 * or whose origin names another repository, since a checkout may be
 * on a disk that is not mounted yet.
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
  const unknownKey = Object.keys(object).find((key) => key !== "repos");
  if (unknownKey !== undefined) {
    return {
      error: `unknown key "${unknownKey}": the only key is "repos"`,
    };
  }
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
    warnings: problems.filter((problem): problem is string => problem !== null),
  };
};

export const credentialsPath = (home: string = configHome()): string =>
  join(home, "credentials.json");
