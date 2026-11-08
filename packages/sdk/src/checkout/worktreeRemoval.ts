import type { BranchPullRequestHead } from "./overview.ts";

/**
 * What removing a worktree would lose, and the refusals a surface and the
 * server both ask before anything is deleted. Browser-safe: the reads and the
 * removal itself are `@reviewflow/sdk/git`'s.
 *
 * **Refuse, never force.** An auto-remove that eats one uncommitted file loses
 * trust for good, so nothing here passes `--force` or `-D`: a dirty worktree, a
 * commit no remote holds, a lock or a process inside is refused with what to
 * do, and git stays the last guard for a file written in between.
 */

export interface WorktreeRemovalStatus {
  /** the worktree, absolute */
  path: string;
  /** the main checkout holds the repository's `.git`: it is never removed */
  main: boolean;
  /** null on a detached HEAD: there is no branch to offer deleting */
  branch: string | null;
  /** tracked files with changes; `git worktree remove` refuses while either is non-zero */
  modified: number;
  untracked: number;
  /**
   * Commits on HEAD that exist only in this clone: reachable from no
   * remote-tracking ref and from no kept sha (a pull request head, which GitHub
   * keeps after the head branch is deleted). git has no guard of its own here.
   */
  unpushedCommits: number;
  /** why git holds it locked, `""` without a reason; null when it is not locked */
  lock: string | null;
  /**
   * Processes whose working directory is inside: a shell, an editor, an agent
   * that would lose the ground under it. Null when it cannot be told (no
   * `lsof`), which refuses nothing.
   */
  processesInside: number | null;
  /**
   * Ignored files, relative to the worktree, not symlinks, that the main
   * checkout does not have: `git worktree remove` deletes them without asking
   * and nothing else holds a copy. A warning, not a refusal: an ignored file is
   * usually ignored because it is disposable.
   */
  localOnlyIgnored: string[];
}

const fileCount = (count: number, kind: string): string | null =>
  count === 0 ? null : `${String(count)} ${kind} file${count === 1 ? "" : "s"}`;

export const mainWorktreeRefusal =
  "This is the main checkout, which holds the repository: it is never removed.";

export const dirtyRefusal = ({
  modified,
  untracked,
}: Pick<WorktreeRemovalStatus, "modified" | "untracked">): string | null => {
  const parts = [
    fileCount(modified, "modified"),
    fileCount(untracked, "untracked"),
  ].filter((part) => part !== null);
  if (parts.length === 0) return null;
  return `${parts.join(" and ")}: git would refuse to remove this worktree. Commit or discard them first.`;
};

export const unpushedRefusal = (count: number): string | null => {
  if (count === 0) return null;
  const subject =
    count === 1 ? "1 commit exists" : `${String(count)} commits exist`;
  return `${subject} only in this clone, on no remote branch and in no pull request. Push them first.`;
};

export const lockRefusal = (lock: string | null): string | null => {
  if (lock === null) return null;
  const reason = lock === "" ? "" : ` (${lock})`;
  return `git holds this worktree locked${reason}, usually by a Claude Code process still running in it. Exit it first.`;
};

export const processesRefusal = (count: number | null): string | null => {
  if (count === null || count === 0) return null;
  const subject =
    count === 1 ? "1 process runs" : `${String(count)} processes run`;
  return `${subject} inside this worktree (a shell, an editor or an agent): removing it would pull the directory out from under them. Exit them first.`;
};

/**
 * Every reason the removal is refused, in the order to act on them; empty when
 * it may go ahead. The server reads the status again and asks the same
 * question before git touches the disk.
 */
export const worktreeRemovalRefusals = (
  status: WorktreeRemovalStatus,
): string[] => {
  if (status.main) return [mainWorktreeRefusal];
  return [
    dirtyRefusal(status),
    unpushedRefusal(status.unpushedCommits),
    lockRefusal(status.lock),
    processesRefusal(status.processesInside),
  ].filter((refusal) => refusal !== null);
};

/** The first refusal, or null when the removal may go ahead. */
export const worktreeRemovalRefusal = (
  status: WorktreeRemovalStatus,
): string | null => worktreeRemovalRefusals(status)[0] ?? null;

/** What a removal did: the worktree is gone; the branch deletion, asked for or not, may have been refused. */
export interface WorktreeRemovalResult {
  path: string;
  /** the branch `git branch -d` was run on; null when not asked, or on a detached HEAD */
  branch: string | null;
  /** git's refusal to delete the branch (unmerged, usually); the removal stands */
  branchError: string | null;
}

/**
 * `GET /api/repos/worktree-status?repo=<owner/repo>&worktree=<path>` — what
 * removing the worktree would lose, its branch's pull request heads counted as
 * pushed.
 */
export interface WorktreeRemovalStatusResponse {
  status: WorktreeRemovalStatus;
  /** the pull requests of its branch, a reused name's older ones left out; empty on a detached HEAD or when GitHub failed */
  pullRequests: BranchPullRequestHead[];
  /** why GitHub could not be read: its heads then prove nothing, the count errs toward refusing */
  pullRequestsError: string | null;
}

/**
 * `POST /api/repos/worktree-remove?repo=<owner/repo>&worktree=<path>` —
 * answered once git has removed it, or with the first refusal as a 400.
 */
export interface WorktreeRemovalRequest {
  /** run `git branch -d` after the removal; a refusal is reported, never fatal */
  deleteBranch: boolean;
}
