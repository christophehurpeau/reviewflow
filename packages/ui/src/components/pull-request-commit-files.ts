import type { PullRequestCommit } from "@reviewflow/sdk";

/**
 * How a file of one commit's diff relates to the pull request's diff, which
 * threads, pending comments and viewed marks are read on.
 *
 * - `pullRequest`: no other commit of the pull request changes it, so both
 *   sides of this commit's diff are the pull request's.
 * - `head`: an earlier commit changed it too: the new side is the head's, the
 *   old side is not the base's.
 * - `commit`: a later commit changes it again: neither side is the pull
 *   request's, so a comment is anchored on this commit and goes out alone.
 */
export type CommitFileAnchoring = "commit" | "head" | "pullRequest";

export type CommitsToRead =
  | { kind: "available"; commits: PullRequestCommit[] }
  | { kind: "none" }
  | { kind: "unavailable"; reason: string };

interface CommitsToReadParams {
  /** oldest first, as GitHub lists them */
  listed: PullRequestCommit[];
  /** every commit of the pull request, `listed` included */
  total: number;
  /** the head the diff shows */
  head: string;
}

const isChain = (commits: PullRequestCommit[]): boolean =>
  commits.every(
    (commit, index) =>
      index === 0 || commit.parentOid === commits[index - 1]?.oid,
  );

/**
 * The commits up to the head shown, which can be read one by one only when
 * each one's diff against its parent is a part of the pull request's: a chain
 * with no merge, which a merge would break by carrying what it merged in.
 */
export const commitsToRead = ({
  listed,
  total,
  head,
}: CommitsToReadParams): CommitsToRead => {
  const end = listed.findIndex(({ oid }) => oid === head);
  if (end === -1) {
    return {
      kind: "unavailable",
      reason:
        total > listed.length
          ? "The pull request has more commits than GitHub lists at once"
          : "The commits listed do not lead to the head shown",
    };
  }
  const commits = listed.slice(0, end + 1);
  if (commits.length < 2) return { kind: "none" };
  if (commits.some(({ merge }) => merge)) {
    return {
      kind: "unavailable",
      reason: "A merge commit's own diff carries what it merged in",
    };
  }
  if (commits[0]?.parentOid === null || !isChain(commits)) {
    return {
      kind: "unavailable",
      reason: "The commits do not follow one another",
    };
  }
  return { kind: "available", commits };
};

/** The index of the commit after `oid`; 0, every commit, when `oid` is null or not one of them. */
export const firstCommitAfter = (
  commits: PullRequestCommit[],
  oid: string | null,
): number =>
  oid === null ? 0 : commits.findIndex((commit) => commit.oid === oid) + 1;

/** No path is changed by more than one commit. */
export const touchDifferentFiles = (
  pathsByCommit: readonly ReadonlySet<string>[],
): boolean => {
  const seen = new Set<string>();
  for (const paths of pathsByCommit) {
    for (const path of paths) {
      if (seen.has(path)) return false;
      seen.add(path);
    }
  }
  return true;
};

const unionOf = (pathsByCommit: readonly ReadonlySet<string>[]): Set<string> =>
  new Set(pathsByCommit.flatMap((paths) => [...paths]));

/** Every path of the commit at `index`, with how it is anchored. */
export const commitAnchorings = (
  pathsByCommit: readonly ReadonlySet<string>[],
  index: number,
): Map<string, CommitFileAnchoring> => {
  const earlier = unionOf(pathsByCommit.slice(0, index));
  const later = unionOf(pathsByCommit.slice(index + 1));
  const anchoringOf = (path: string): CommitFileAnchoring => {
    if (later.has(path)) return "commit";
    if (earlier.has(path)) return "head";
    return "pullRequest";
  };
  return new Map(
    [...(pathsByCommit[index] ?? [])].map((path) => [path, anchoringOf(path)]),
  );
};

/** What one commit changes, to pick it from a list. */
export interface CommitSummary {
  /** the commit's workspaces, the root named "Root" */
  workspaces: string[];
  /** the files it changes, as `changedPathsOf` counts them */
  files: number;
}

interface SummarizeCommitsParams {
  /** the diff of each readable commit, as loaded */
  diffs: readonly { groups: readonly { name: string }[] }[];
  /** the paths each diff changes, aligned with `diffs` */
  pathsByCommit: readonly ReadonlySet<string>[];
  /** where the stepped commits start in the readable ones */
  sinceIndex: number;
}

/**
 * The summaries of the stepped commits: the diffs are those of every readable
 * commit, so those before `sinceIndex` are left out, as the commits are.
 */
export const summarizeCommits = ({
  diffs,
  pathsByCommit,
  sinceIndex,
}: SummarizeCommitsParams): CommitSummary[] =>
  diffs.slice(sinceIndex).map(({ groups }, index) => ({
    workspaces: groups.map(({ name }) => (name === "" ? "Root" : name)),
    files: pathsByCommit[sinceIndex + index]?.size ?? 0,
  }));
