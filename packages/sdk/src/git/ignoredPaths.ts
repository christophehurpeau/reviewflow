import { gitOrNull } from "./run.ts";

/** One `git check-ignore` checks at most this many: past it, a sample stands for the batch. */
const maxCheckedPaths = 200;

/**
 * The paths (relative to `cwd`) that git does not ignore, in one git call. A
 * batch larger than `maxCheckedPaths` is judged on its first ones: a change
 * that big (an install, a checkout) is either all build output or real work.
 * A failed check keeps every path: a missed refresh is worse than an extra one.
 */
export const filterIgnoredPaths = async (
  cwd: string,
  paths: string[],
): Promise<string[]> => {
  const checked = paths.slice(0, maxCheckedPaths);
  if (checked.length === 0) return [];
  // exits 1 when nothing is ignored, which gitOrNull reads as null
  const stdout = await gitOrNull(cwd, ["check-ignore", "--", ...checked]);
  if (stdout === null) return checked;
  const ignored = new Set(stdout.split("\n").filter((line) => line !== ""));
  return checked.filter((path) => !ignored.has(path));
};

/** The directory every worktree of the repository at `cwd` shares: its refs and its objects. */
export const readGitCommonDir = async (cwd: string): Promise<string | null> => {
  const stdout = await gitOrNull(cwd, [
    "rev-parse",
    "--path-format=absolute",
    "--git-common-dir",
  ]);
  const path = stdout?.trim() ?? "";
  return path === "" ? null : path;
};
