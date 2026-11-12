import { lstat } from "node:fs/promises";
import { join } from "node:path";
import type {
  DiffFileStat,
  DiffFileStatus,
  DiffOmittedFile,
  DiffWhitespace,
} from "../diff/types.ts";
import { git } from "./run.ts";

/**
 * The patch of a branch since its merge base, in the unified format any diff
 * viewer parses.
 *
 * **The operator's git config is neutralised flag by flag**, since every one of
 * these would break the parse in the viewer: `diff.noprefix` and
 * `diff.mnemonicPrefix` (explicit prefixes), `color.ui=always` (`--no-color`),
 * `diff.external` (`--no-ext-diff`), a textconv driver (`--no-textconv`),
 * `diff.relative` (`--no-relative`) and `core.quotePath` (octal-escaped names).
 *
 * **Bounded twice.** `--numstat` runs first and is cheap: a binary file, a file
 * past `maxLinesPerFile` (a lockfile) and everything past the total budget are
 * listed as omitted and excluded from the patch by pathspec, so one generated
 * file never costs the whole diff. `maxBuffer` is the backstop for what line
 * counts cannot see — a minified file is one line.
 *
 * **Untracked files are diffed against `/dev/null` one by one**, never through
 * `git add -N`: that writes the index, and a read must not change what the user
 * will commit. Whitespace is never hidden there: every line of a new file is an
 * addition.
 *
 * **Hiding whitespace is `-w` on both reads**, so the budget counts the lines
 * shown. `git diff -w` drops a file whose every change is whitespace, so a
 * third read without it names those files, listed as omitted.
 *
 * **Each file's status and line counts ride on the numstat read** (`--raw`
 * beside `--numstat`), so they cost no git call of their own, and they are
 * returned for the omitted files too: a binary file is always left out, and is
 * the one a reader most needs told was added or deleted.
 */

export interface DiffLimits {
  maxLinesPerFile: number;
  maxTotalLines: number;
  maxFiles: number;
  /** untracked files read under the `workingTree` scope; the rest are omitted */
  maxUntrackedFiles: number;
  /** an untracked file larger than this is omitted as too large */
  maxUntrackedBytes: number;
}

export const defaultDiffLimits: DiffLimits = {
  maxLinesPerFile: 3000,
  maxTotalLines: 30_000,
  maxFiles: 500,
  maxUntrackedFiles: 100,
  maxUntrackedBytes: 512 * 1024,
};

const maxPatchBytes = 64 * 1024 * 1024;

const neutralConfig = ["-c", "core.quotePath=false"];

const diffFlags = [
  "--no-color",
  "--no-ext-diff",
  "--no-textconv",
  "--src-prefix=a/",
  "--dst-prefix=b/",
];

export interface NumstatEntry {
  /** the path after the change, the one a viewer names */
  path: string;
  /** both sides of a rename, which must be excluded together */
  paths: string[];
  /** null for a binary file */
  lines: number | null;
}

interface CountedEntry extends NumstatEntry {
  /** null for a binary file, as `lines` */
  additions: number | null;
  deletions: number | null;
}

/**
 * `-z` keeps names verbatim. A rename leaves the path field empty and puts
 * both names in the next two records.
 */
const parseNumstatRecords = (
  records: readonly string[],
  start: number,
): CountedEntry[] => {
  const entries: CountedEntry[] = [];
  for (let index = start; index < records.length; index++) {
    const record = records[index] ?? "";
    if (record === "") continue;
    const [added = "", deleted = "", ...rest] = record.split("\t");
    const binary = added === "-" || deleted === "-";
    const additions = binary ? null : Number(added);
    const deletions = binary ? null : Number(deleted);
    const lines =
      additions === null || deletions === null ? null : additions + deletions;
    const path = rest.join("\t");
    if (path !== "") {
      entries.push({ path, paths: [path], lines, additions, deletions });
      continue;
    }
    const from = records[index + 1] ?? "";
    const to = records[index + 2] ?? "";
    index += 2;
    entries.push({ path: to, paths: [from, to], lines, additions, deletions });
  }
  return entries;
};

export const parseNumstat = (output: string): NumstatEntry[] =>
  parseNumstatRecords(output.split("\0"), 0).map(({ path, paths, lines }) => ({
    path,
    paths,
    lines,
  }));

/** A file of `--raw --numstat`: its numstat, and what the change did to it. */
export interface FileChangeEntry extends NumstatEntry {
  stat: DiffFileStat;
}

interface RawChange {
  status: DiffFileStatus;
  previousPath: string | null;
}

/** git's `--raw` letter; a copy (`C`, only with `-C`) makes a new file */
const statusOfLetter = (letter: string): DiffFileStatus => {
  if (letter === "A" || letter === "C") return "added";
  if (letter === "D") return "deleted";
  if (letter === "R") return "renamed";
  return "modified";
};

/**
 * `--raw --numstat -z`: the raw records first, each a `:`-led header then its
 * path, or both paths of a rename or a copy; the numstat records after them.
 * A path record is consumed by its header, so a name starting with `:` is
 * never taken for one. A file the raw part does not name counts as modified.
 */
export const parseRawNumstat = (output: string): FileChangeEntry[] => {
  const records = output.split("\0");
  const changes = new Map<string, RawChange>();
  let index = 0;
  while ((records[index] ?? "").startsWith(":")) {
    const letter = (records[index] ?? "").split(" ")[4]?.charAt(0) ?? "";
    const status = statusOfLetter(letter);
    if (letter === "R" || letter === "C") {
      changes.set(records[index + 2] ?? "", {
        status,
        previousPath: letter === "R" ? (records[index + 1] ?? "") : null,
      });
      index += 3;
    } else {
      changes.set(records[index + 1] ?? "", { status, previousPath: null });
      index += 2;
    }
  }
  return parseNumstatRecords(records, index).map(
    ({ additions, deletions, ...entry }) => {
      const change = changes.get(entry.path);
      return {
        ...entry,
        stat: {
          path: entry.path,
          previousPath: change?.previousPath ?? null,
          status: change?.status ?? "modified",
          additions,
          deletions,
        },
      };
    },
  );
};

interface Budget {
  files: number;
  lines: number;
}

const omissionReason = (
  lines: number | null,
  budget: Budget,
  limits: DiffLimits,
): DiffOmittedFile["reason"] | null => {
  if (lines === null) return "binary";
  if (lines > limits.maxLinesPerFile) return "tooLarge";
  if (
    budget.files + 1 > limits.maxFiles ||
    budget.lines + lines > limits.maxTotalLines
  ) {
    return "budget";
  }
  return null;
};

/**
 * One pathspec per path makes the command line grow with the diff: naming
 * the shorter side keeps it under the OS argument limit for a codemod touching
 * tens of thousands of files, since what is shown is capped by `maxFiles`.
 */
const pathspecs = (included: string[], excluded: string[]): string[] => {
  if (excluded.length === 0) return [];
  if (included.length < excluded.length) {
    return ["--", ...included.map((path) => `:(literal)${path}`)];
  }
  return ["--", ...excluded.map((path) => `:(exclude,literal)${path}`)];
};

interface TrackedDiff {
  patch: string;
  /** the files in `patch`, after any rename */
  paths: string[];
  omitted: DiffOmittedFile[];
  /** every file of `paths` and `omitted` */
  files: DiffFileStat[];
}

export const readNumstat = async (
  cwd: string,
  range: string[],
  whitespaceFlags: string[],
): Promise<NumstatEntry[]> =>
  parseNumstat(
    await git(cwd, [
      ...neutralConfig,
      "diff",
      "--no-relative",
      "-M",
      ...whitespaceFlags,
      "--numstat",
      "-z",
      ...range,
    ]),
  );

const readFileChanges = async (
  cwd: string,
  range: string[],
  whitespaceFlags: string[],
): Promise<FileChangeEntry[]> =>
  parseRawNumstat(
    await git(cwd, [
      ...neutralConfig,
      "diff",
      "--no-relative",
      "-M",
      ...whitespaceFlags,
      "--raw",
      "--numstat",
      "-z",
      ...range,
    ]),
  );

/** Read without `-w`: their counts are their whitespace changes. */
const whitespaceOnlyFiles = async (
  cwd: string,
  range: string[],
  shown: NumstatEntry[],
): Promise<FileChangeEntry[]> => {
  const shownPaths = new Set(shown.map(({ path }) => path));
  const all = await readFileChanges(cwd, range, []);
  return all.filter(({ path }) => !shownPaths.has(path));
};

interface ReadTrackedDiffParams {
  cwd: string;
  range: string[];
  whitespace: DiffWhitespace;
  limits: DiffLimits;
  budget: Budget;
}

const readTrackedDiff = async ({
  cwd,
  range,
  whitespace,
  limits,
  budget,
}: ReadTrackedDiffParams): Promise<TrackedDiff> => {
  const whitespaceFlags = whitespace === "hide" ? ["-w"] : [];
  const entries = await readFileChanges(cwd, range, whitespaceFlags);
  const whitespaceOnly =
    whitespace === "hide" ? await whitespaceOnlyFiles(cwd, range, entries) : [];
  const omitted: DiffOmittedFile[] = whitespaceOnly.map(({ path }) => ({
    path,
    reason: "whitespace",
  }));
  const files = [...entries, ...whitespaceOnly].map(({ stat }) => stat);
  const excluded: string[] = [];
  const included: string[] = [];
  const paths: string[] = [];
  for (const entry of entries) {
    const reason = omissionReason(entry.lines, budget, limits);
    if (reason === null) {
      budget.files += 1;
      budget.lines += entry.lines ?? 0;
      paths.push(entry.path);
      included.push(...entry.paths);
      continue;
    }
    omitted.push({ path: entry.path, reason });
    excluded.push(...entry.paths);
  }
  if (paths.length === 0) return { patch: "", paths, omitted, files };

  const patch = await git(
    cwd,
    [
      ...neutralConfig,
      "diff",
      ...diffFlags,
      "--no-relative",
      "-M",
      ...whitespaceFlags,
      ...range,
      ...pathspecs(included, excluded),
    ],
    { maxBuffer: maxPatchBytes },
  );
  return { patch, paths, omitted, files };
};

const countAddedLines = (patch: string): number => {
  const lines = patch.split("\n");
  const firstHunk = lines.findIndex((line) => line.startsWith("@@"));
  if (firstHunk === -1) return 0;
  return lines.slice(firstHunk).filter((line) => line.startsWith("+")).length;
};

const isBinaryPatch = (patch: string): boolean => /^Binary files /m.test(patch);

interface UntrackedDiff {
  patches: string[];
  /** the files in `patches`, in the same order */
  paths: string[];
  omitted: DiffOmittedFile[];
  /** every file of `paths` and `omitted` */
  files: DiffFileStat[];
}

/** `lines` null: binary, or left out before it was read. */
const untrackedStat = (path: string, lines: number | null): DiffFileStat => ({
  path,
  previousPath: null,
  status: "added",
  additions: lines,
  deletions: lines === null ? null : 0,
});

const readUntrackedDiff = async (
  cwd: string,
  limits: DiffLimits,
  budget: Budget,
): Promise<UntrackedDiff> => {
  const listing = await git(cwd, [
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
  ]);
  const listed = listing.split("\0").filter((path) => path !== "");
  const patches: string[] = [];
  const paths: string[] = [];
  const omitted: DiffOmittedFile[] = [];
  const files: DiffFileStat[] = [];

  for (const [index, path] of listed.entries()) {
    if (index >= limits.maxUntrackedFiles) {
      omitted.push({ path, reason: "budget" });
      files.push(untrackedStat(path, null));
      continue;
    }
    const entry = await lstat(join(cwd, path)).catch(() => null);
    // gone between the listing and this read, or a nested repository
    if (entry === null || entry.isDirectory()) continue;
    if (entry.size > limits.maxUntrackedBytes) {
      omitted.push({ path, reason: "tooLarge" });
      files.push(untrackedStat(path, null));
      continue;
    }
    const patch = await git(
      cwd,
      [
        ...neutralConfig,
        "diff",
        ...diffFlags,
        "--no-index",
        "--",
        "/dev/null",
        path,
      ],
      { exitOneIsAnswer: true, maxBuffer: maxPatchBytes },
    );
    const lines = isBinaryPatch(patch) ? null : countAddedLines(patch);
    files.push(untrackedStat(path, lines));
    const reason = omissionReason(lines, budget, limits);
    if (reason !== null) {
      omitted.push({ path, reason });
      continue;
    }
    budget.files += 1;
    budget.lines += lines ?? 0;
    patches.push(patch);
    paths.push(path);
  }
  return { patches, paths, omitted, files };
};

export interface BranchDiff {
  patch: string;
  /** the files in `patch`, in its order */
  paths: string[];
  omitted: DiffOmittedFile[];
  /** the untracked files in `patch`; always 0 under `committed` */
  untrackedCount: number;
  /** every file of `paths` in its order, then of `omitted` in its order */
  files: DiffFileStat[];
}

/** Each listed file's stat once, in the order the response promises. */
const orderStats = (
  paths: readonly string[],
  omitted: readonly DiffOmittedFile[],
  stats: readonly DiffFileStat[],
): DiffFileStat[] => {
  const byPath = new Map(stats.map((stat) => [stat.path, stat]));
  return [...paths, ...omitted.map(({ path }) => path)].flatMap((path) => {
    const stat = byPath.get(path);
    return stat === undefined ? [] : [stat];
  });
};

/**
 * Where the diff ends: `committed` at a commit, `workingTree` at the files on
 * disk, staged, unstaged and untracked changes included.
 */
export type BranchDiffEnd = "committed" | "workingTree";

interface ReadBranchDiffParams {
  cwd: string;
  mergeBase: string;
  /** `committed` unless set: the pull request path reads no working tree */
  scope?: BranchDiffEnd;
  /**
   * The commit the `committed` scope ends at: a pull request's head, which no
   * worktree need be on, or `HEAD` unless set. Ignored under `workingTree`.
   */
  head?: string;
  /** `show` unless set */
  whitespace?: DiffWhitespace;
  limits?: DiffLimits;
}

export const readBranchDiff = async ({
  cwd,
  mergeBase,
  scope = "committed",
  head = "HEAD",
  whitespace = "show",
  limits = defaultDiffLimits,
}: ReadBranchDiffParams): Promise<BranchDiff> => {
  if (mergeBase.startsWith("-") || head.startsWith("-")) {
    throw new Error(
      `not a revision: ${mergeBase.startsWith("-") ? mergeBase : head}`,
    );
  }
  const budget: Budget = { files: 0, lines: 0 };
  const tracked = await readTrackedDiff({
    cwd,
    range: scope === "committed" ? [mergeBase, head] : [mergeBase],
    whitespace,
    limits,
    budget,
  });
  if (scope === "committed") {
    return {
      patch: tracked.patch,
      paths: tracked.paths,
      omitted: tracked.omitted,
      untrackedCount: 0,
      files: orderStats(tracked.paths, tracked.omitted, tracked.files),
    };
  }
  const untracked = await readUntrackedDiff(cwd, limits, budget);
  const paths = [...tracked.paths, ...untracked.paths];
  const omitted = [...tracked.omitted, ...untracked.omitted];
  return {
    patch: [tracked.patch, ...untracked.patches].join(""),
    paths,
    omitted,
    untrackedCount: untracked.patches.length,
    files: orderStats(paths, omitted, [...tracked.files, ...untracked.files]),
  };
};
