import {
  closeSync,
  lstatSync,
  openSync,
  readFileSync,
  readSync,
  readlinkSync,
  realpathSync,
  statSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import type {
  CheckoutFileAtHead,
  CheckoutFileLink,
  CheckoutFileRead,
  CheckoutFileSaveRequest,
  CheckoutFileSaveResponse,
  CheckoutFileStatus,
  CheckoutFilesResponse,
  CheckoutLinkDeadEnd,
} from "../checkout/files.ts";
import { git } from "../git/run.ts";
import { saveEditableFile } from "./editableFile.ts";

/** Past this a file is not opened: the editor holds the whole text in memory and in the page. */
export const maxCheckoutFileBytes = 2 * 1024 * 1024;

/** git's own test for a binary file: a NUL byte in its first 8000 bytes. */
const binaryProbeBytes = 8000;

export interface CheckoutRoots {
  /** the directory paths are named from: a worktree, or the main checkout itself */
  checkout: string;
  /**
   * Also inside the bounds: the main checkout of the repo `checkout` belongs
   * to. A file git ignores (`.env`, `.vscode/settings.json`) often exists in a
   * worktree only as a symlink to the main checkout's — the same repo's file.
   */
  mainCheckout?: string;
}

/**
 * One `git status --porcelain=v1 -z --no-renames` entry's two letters (index,
 * then working tree) as the one state the tree shows. A deletion on either
 * side wins: the file is not on disk to open. An unmerged path is modified.
 */
const statusOfLetters = (letters: string): CheckoutFileStatus => {
  if (letters === "??") return "untracked";
  if (letters.includes("D")) return "deleted";
  if (letters.startsWith("A")) return "added";
  return "modified";
};

/**
 * git names a nested repository it does not descend into — a worktree checked
 * out inside the checkout (`.claude/worktrees/<slug>`), a clone — as an
 * untracked directory, its path ending in `/`. It is not a file to list.
 */
const isFilePath = (path: string): boolean =>
  path !== "" && !path.endsWith("/");

/** `git status --porcelain=v1 -z --no-renames`: `XY path\0` per entry, no rename pairs. */
export const parseCheckoutStatuses = (
  output: string,
): Record<string, CheckoutFileStatus> =>
  Object.fromEntries(
    output
      .split("\0")
      .filter((entry) => entry.length > 3 && isFilePath(entry.slice(3)))
      .map((entry) => [entry.slice(3), statusOfLetters(entry.slice(0, 2))]),
  );

/**
 * Every file of the working tree, tracked and untracked, minus what
 * `.gitignore` excludes, and each one's git state. Read from the working tree
 * rather than a commit, so a file the agent or the reviewer has just created is
 * in it. A deleted file stays listed, as deleted: the tree shows what is gone,
 * and opening it says so. A submodule is listed as its own path, which then
 * reads as refused (not a file).
 */
export const listCheckoutFiles = async (
  checkout: string,
): Promise<CheckoutFilesResponse> => {
  const listing = { maxBuffer: 256 * 1024 * 1024 };
  const [present, status] = await Promise.all([
    git(
      checkout,
      ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
      listing,
    ),
    git(
      checkout,
      [
        "status",
        "--porcelain=v1",
        "-z",
        "--no-renames",
        "--untracked-files=all",
      ],
      listing,
    ),
  ]);
  const statuses = parseCheckoutStatuses(status);
  // an unmerged path is listed once per stage; a deletion staged with `git rm`
  // is in the status only
  const paths = new Set([
    ...present.split("\0").filter(isFilePath),
    ...Object.keys(statuses),
  ]);
  return { paths: [...paths].toSorted(), statuses };
};

const isInside = (directory: string, path: string): boolean => {
  const relativePath = relative(directory, path);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  );
};

const errorCode = (error: unknown): unknown =>
  (error as NodeJS.ErrnoException | null)?.code;

/** The realpath of `path`, or of its deepest existing ancestor with the rest re-attached. */
const realpathOfMaybeMissing = (path: string): string => {
  const missing: string[] = [];
  let current = path;
  for (;;) {
    try {
      const real = realpathSync.native(current);
      return missing.length === 0 ? real : join(real, ...missing.toReversed());
    } catch (error) {
      const parent = dirname(current);
      if (errorCode(error) !== "ENOENT" || parent === current) throw error;
      missing.push(basename(current));
      current = parent;
    }
  }
};

export type ResolvedCheckoutPath =
  /**
   * `resolvesTo` is set once the path itself is inside the checkout and what
   * it resolves to is refused: for a symlink, why it opens nothing
   */
  | { refused: string; resolvesTo?: Exclude<CheckoutLinkDeadEnd, "missing"> }
  | { realPath: string; exists: boolean };

/**
 * The file `relativePath` names, confined to the checkout **by realpath**: a
 * symlink committed in the repo (`notes -> ~/.ssh`) resolves elsewhere, and a
 * textual test accepts it. Nothing under a `.git` directory is reachable
 * either: writing `.git/hooks/pre-commit` is running code on the next commit.
 */
export const resolveCheckoutPath = (
  { checkout, mainCheckout }: CheckoutRoots,
  relativePath: string,
): ResolvedCheckoutPath => {
  if (relativePath === "" || isAbsolute(relativePath)) {
    return { refused: "path must be relative to the checkout" };
  }
  if (relativePath.split(/[/\\]/).includes(".git")) {
    return { refused: `${relativePath} is inside .git` };
  }
  const path = join(checkout, relativePath);
  if (path === checkout || !isInside(checkout, path)) {
    return { refused: `${relativePath} is outside the checkout` };
  }

  let realPath: string;
  let realRoots: string[];
  try {
    realRoots = [
      checkout,
      ...(mainCheckout === undefined ? [] : [mainCheckout]),
    ].map((root) => realpathSync.native(root));
    realPath = realpathOfMaybeMissing(path);
  } catch {
    return { refused: `${relativePath} could not be resolved` };
  }
  if (!realRoots.some((root) => isInside(root, realPath))) {
    return {
      refused: `${relativePath} resolves outside the repository`,
      resolvesTo: "outside",
    };
  }
  if (realPath.split(sep).includes(".git")) {
    return {
      refused: `${relativePath} resolves inside .git`,
      resolvesTo: "gitDirectory",
    };
  }

  try {
    const stats = statSync(realPath);
    if (stats.isDirectory()) {
      return {
        refused: `${relativePath} is not a file`,
        resolvesTo: "directory",
      };
    }
    if (!stats.isFile()) return { refused: `${relativePath} is not a file` };
    return { realPath, exists: true };
  } catch (error) {
    if (errorCode(error) === "ENOENT") return { realPath, exists: false };
    return { refused: `${relativePath} could not be read` };
  }
};

const hasNulByte = (path: string): boolean => {
  const descriptor = openSync(path, "r");
  try {
    const probe = Buffer.alloc(binaryProbeBytes);
    const read = readSync(descriptor, probe, 0, binaryProbeBytes, 0);
    return probe.subarray(0, read).includes(0);
  } finally {
    closeSync(descriptor);
  }
};

const readLinkTarget = (path: string): string | null => {
  try {
    return lstatSync(path).isSymbolicLink() ? readlinkSync(path) : null;
  } catch {
    return null;
  }
};

/** `realPath` relative to the checkout, or null when it is not inside it (the main checkout's). */
const checkoutRelativePath = (
  checkout: string,
  realPath: string,
): string | null => {
  const realCheckout = realpathSync.native(checkout);
  return isInside(realCheckout, realPath)
    ? relative(realCheckout, realPath).split(sep).join("/")
    : null;
};

/**
 * The symlink `relativePath` is, or null for a plain file. Only called once
 * `resolveCheckoutPath` accepted the path itself as inside the checkout.
 */
const describeCheckoutLink = (
  checkout: string,
  relativePath: string,
  realFilePath: string | null,
): CheckoutFileLink | null => {
  const target = readLinkTarget(join(checkout, relativePath));
  if (target === null) return null;
  return {
    target,
    path:
      realFilePath === null
        ? null
        : checkoutRelativePath(checkout, realFilePath),
  };
};

/**
 * One file's text, read from disk on every call: a file the agent or another
 * editor changed must not come back stale. A symlink to a file of the
 * repository reads as that file, with `link` set; one that opens nothing (a
 * directory, a missing target, outside the repository) is `{ status: "link" }`
 * and why. Any other refusal (outside the checkout, not a file) is
 * `{ refused }`, for the host to answer as a bad request.
 */
export const readCheckoutFile = (
  roots: CheckoutRoots,
  relativePath: string,
): CheckoutFileRead | { refused: string } => {
  const resolved = resolveCheckoutPath(roots, relativePath);
  if ("refused" in resolved) {
    if (resolved.resolvesTo === undefined) return { refused: resolved.refused };
    const link = describeCheckoutLink(roots.checkout, relativePath, null);
    return link === null
      ? { refused: resolved.refused }
      : { status: "link", link, resolvesTo: resolved.resolvesTo };
  }
  const link = describeCheckoutLink(
    roots.checkout,
    relativePath,
    resolved.exists ? resolved.realPath : null,
  );
  if (!resolved.exists) {
    return link === null
      ? { status: "absent" }
      : { status: "link", link, resolvesTo: "missing" };
  }
  const throughLink = link === null ? {} : { link };
  try {
    const { size } = statSync(resolved.realPath);
    if (size > maxCheckoutFileBytes) {
      return {
        status: "tooLarge",
        bytes: size,
        limit: maxCheckoutFileBytes,
        ...throughLink,
      };
    }
    if (hasNulByte(resolved.realPath)) {
      return { status: "binary", ...throughLink };
    }
    return {
      status: "text",
      source: readFileSync(resolved.realPath, "utf8"),
      ...throughLink,
    };
  } catch (error) {
    if (errorCode(error) === "ENOENT") return { status: "absent" };
    return { refused: `${relativePath} could not be read` };
  }
};

/**
 * Saves one existing file, behind `saveEditableFile`'s changed-since-opened
 * refusal. The text is written as typed — no final newline added: an editor
 * that rewrote what it was not asked to would show up in the next diff. A file
 * that does not exist is refused rather than created: creating files is not
 * this editor's yet, and a save racing a deletion must not bring the file back.
 */
export const saveCheckoutFile = async (
  roots: CheckoutRoots,
  { path, source, expectedSource }: CheckoutFileSaveRequest,
): Promise<CheckoutFileSaveResponse | { refused: string }> => {
  const resolved = resolveCheckoutPath(roots, path);
  if ("refused" in resolved) return resolved;
  if (!resolved.exists) return { refused: `${path} no longer exists` };
  const result = await saveEditableFile({
    path: resolved.realPath,
    source,
    expectedSource,
    validate: () => ({ warnings: [] }),
    trailingNewline: false,
  });
  return result.status === "conflict"
    ? { status: "conflict", source: result.source }
    : result;
};

/** `git ls-tree -l -z`: `<mode> <type> <sha> <size>\t<path>\0`, the size padded. */
const parseTreeEntry = (
  output: string,
): { mode: string; sha: string; bytes: number } | null => {
  const match = /^(\d+) blob ([\da-f]+) +(\d+)\t/.exec(output);
  if (match === null) return null;
  return { mode: match[1]!, sha: match[2]!, bytes: Number(match[3]) };
};

/**
 * One file as `HEAD` has it: what the editor's draft is diffed against before
 * it is saved. The path is a git path, not a disk one, so nothing on disk is
 * reached; it is still refused outside the checkout's own names. Read by
 * `ls-tree` then `cat-file blob <sha>` — the path never goes through a
 * `<rev>:<path>` parse — with literal pathspecs, so a `*` in a name is a `*`.
 * An unborn `HEAD` has no files: absent.
 */
export const readCheckoutFileAtHead = async (
  checkout: string,
  relativePath: string,
): Promise<CheckoutFileAtHead | { refused: string }> => {
  const segments = relativePath.split(/[/\\]/);
  if (
    relativePath === "" ||
    isAbsolute(relativePath) ||
    segments.includes("..") ||
    segments.includes(".git")
  ) {
    return { refused: `${relativePath} is not a path of the checkout` };
  }
  let listing: string;
  try {
    listing = await git(checkout, [
      "--literal-pathspecs",
      "ls-tree",
      "-l",
      "-z",
      "HEAD",
      "--",
      relativePath,
    ]);
  } catch {
    // an unborn branch: HEAD names no tree
    return { status: "absent" };
  }
  const entry = parseTreeEntry(listing);
  if (entry === null) return { status: "absent" };
  if (entry.mode === "120000") return { status: "link" };
  if (entry.bytes > maxCheckoutFileBytes) {
    return {
      status: "tooLarge",
      bytes: entry.bytes,
      limit: maxCheckoutFileBytes,
    };
  }
  const source = await git(checkout, ["cat-file", "blob", entry.sha], {
    maxBuffer: maxCheckoutFileBytes + 1024,
  });
  return source.slice(0, binaryProbeBytes).includes("\0")
    ? { status: "binary" }
    : { status: "text", source };
};
