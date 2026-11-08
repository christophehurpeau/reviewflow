/**
 * `show` is git's plain diff. `hide` is `git diff -w`, GitHub's "Hide
 * whitespace": a line whose only change is whitespace is not a change.
 */
export type DiffWhitespace = "hide" | "show";

export const isDiffWhitespace = (value: unknown): value is DiffWhitespace =>
  value === "hide" || value === "show";

/**
 * Where a diff read is at, for a caller that shows progress: the objects are
 * being fetched into the checkout, or the patch is being computed.
 */
export type DiffStep = "diffing" | "fetching";

/**
 * `whitespace`: every change of the file is whitespace, and whitespace is
 * hidden. Listed rather than dropped, since `git diff -w` names no such file
 * and the reader would not know it changed.
 */
export type DiffOmittedReason = "binary" | "budget" | "tooLarge" | "whitespace";

export interface DiffOmittedFile {
  path: string;
  reason: DiffOmittedReason;
}

/**
 * The files of one package: the nearest directory above them holding a
 * manifest (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`,
 * `Gemfile`…), the repo root excepted. A file in no package goes under
 * its first directory, and one at the root under `""`.
 */
export interface DiffGroup {
  /** relative to the checkout; `""` is the root */
  name: string;
  /** as the patch names them, after any rename */
  paths: string[];
}

export interface DiffReadingFile {
  /** as the patch names it, after any rename */
  path: string;
  /** no other changed file of its package imports it, and it imports some */
  entry: boolean;
  /**
   * a non-test TypeScript file no other changed file of its package imports:
   * the entry points, and the files that import nothing changed either
   */
  root: boolean;
  /** the tests and stories of this file, read below it */
  attached: string[];
}

/**
 * One package's changed files in reading order: from each entry point down
 * through what it imports, depth first; then the files that are not
 * TypeScript, in patch order; then the tests and stories covering no changed
 * file.
 */
export interface DiffReadingGroup {
  /** the package, as `DiffGroup.name` */
  name: string;
  /** every changed file of the package once, an attached one under its subject only */
  files: DiffReadingFile[];
}

/**
 * `GET /api/prs/reading-order?repo=<owner/repo>&number=<n>&head=<sha>&base=<sha>`
 * — the files of the same range as `/api/prs/diff`, ordered for reading:
 * packages from the one depending on the others down, files from the entry
 * points down. Read from the registered checkout at `head` (relative
 * TypeScript imports only); answered with a `DiffRefusal` without one.
 */
export interface DiffReadingOrderResponse {
  groups: DiffReadingGroup[];
}

/**
 * `GET /api/prs/diff?repo=<owner/repo>&number=<n>&head=<sha>&base=<sha>&whitespace=<hide|show>`
 * — the pull request's changes: head against its merge base with the base tip,
 * which is what GitHub shows. The two shas are the detail's, so the diff is of
 * the pull request the screen shows.
 *
 * Read from **local git** when the repository is registered — the commits are
 * fetched by sha into its checkout when missing, writing no ref — with size
 * bounds (binary, too large and over-budget files are left out). From **GitHub's API** otherwise, or when git cannot: a
 * repository with no configured checkout, a fetch refused. GitHub refuses a diff past
 * 300 files or 20,000 lines, which git does not.
 */
export interface PullRequestDiffResponse {
  source: "git" | "github";
  /** why git was not the source, verbatim; null when it was, or no checkout exists */
  fallbackReason: string | null;
  /**
   * What the patch did with whitespace, which is not always what was asked:
   * GitHub's compare endpoint cannot hide it, so its answer is always `show`.
   */
  whitespace: DiffWhitespace;
  /** a unified diff, `a/` and `b/` prefixes, the omitted files left out */
  patch: string;
  /**
   * The commits the patch's two sides are read at (the merge base and the
   * head), for `prFile`; null from GitHub, whose files are not read, so the
   * unchanged lines stay folded.
   */
  sides: { old: string; new: string } | null;
  /** binary, too large or over budget: left out of `patch` (git only) */
  omitted: DiffOmittedFile[];
  /**
   * Every file in `patch`, by package when the repository is registered (its
   * checkout says where the manifests are), by first directory otherwise.
   */
  groups: DiffGroup[];
}

/**
 * `GET /api/prs/file?repo=<owner/repo>&number=<n>&sha=<sha>&path=<path>` — one
 * file of the registered checkout at a commit, so the diff can unfold the lines
 * the patch left out. Local git only; a 400 without a checkout.
 */
export interface PullRequestFileContentsResponse {
  contents: string;
}

/**
 * Why a diff was not read at all: the repository has no checkout the reader
 * may use. Not an error: the user is shown `configPath` and the exact line to
 * add to it.
 *
 * - `notConfigured`: `ownerRepo` is not in the config file.
 * - `invalidPath`: it is, but the path is not a checkout of that repository
 *   (`detail` says what was found).
 */
export interface DiffRefusal {
  reason: "invalidPath" | "notConfigured";
  ownerRepo: string;
  /** the file to edit */
  configPath: string;
  detail: string;
}
