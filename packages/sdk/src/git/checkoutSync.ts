import type {
  CheckoutHeadCommit,
  CheckoutStatus,
  CheckoutSyncResponse,
} from "../checkout/sync.ts";
import { pullRefusal, pushRefusal } from "../checkout/sync.ts";
import { git, gitOrNull } from "./run.ts";

export interface StatusV2 extends Omit<CheckoutStatus, "commit" | "path"> {
  /** false on a branch with no commit yet (`branch.oid (initial)`) */
  hasCommit: boolean;
}

const headerValue = (line: string, key: string): string | null =>
  line.startsWith(`# ${key} `) ? line.slice(`# ${key} `.length) : null;

/**
 * `git status --porcelain=v2 --branch`: `# branch.*` headers, then one line per
 * entry — `1`/`2` for a tracked change, `u` for an unmerged path, `?` for an
 * untracked one (`!` only appears with `--ignored`). `branch.ab` is absent both
 * without an upstream and when the upstream's ref is gone, which is why
 * ahead/behind are null whenever it is.
 */
export const parseStatusV2 = (stdout: string): StatusV2 => {
  const status: StatusV2 = {
    branch: null,
    hasCommit: true,
    upstream: null,
    ahead: null,
    behind: null,
    modified: 0,
    untracked: 0,
  };

  for (const line of stdout.split("\n")) {
    if (line.startsWith("# ")) {
      const oid = headerValue(line, "branch.oid");
      if (oid !== null) status.hasCommit = oid !== "(initial)";
      const head = headerValue(line, "branch.head");
      if (head !== null) status.branch = head === "(detached)" ? null : head;
      const upstream = headerValue(line, "branch.upstream");
      if (upstream !== null) status.upstream = upstream;
      const ab = headerValue(line, "branch.ab");
      const counts = ab === null ? null : /^\+(\d+) -(\d+)$/.exec(ab);
      if (counts) {
        status.ahead = Number(counts[1]);
        status.behind = Number(counts[2]);
      }
    } else if (line.startsWith("? ")) {
      status.untracked += 1;
    } else if (/^[12u] /.test(line)) {
      status.modified += 1;
    }
  }

  return status;
};

const readHeadCommit = async (
  cwd: string,
): Promise<CheckoutHeadCommit | null> => {
  const stdout = await gitOrNull(cwd, [
    "log",
    "-1",
    "--format=%h%x00%s%x00%cI",
    "--no-patch",
  ]);
  const [shortSha, subject, committedAt] = (stdout?.trim() ?? "").split("\0");
  if (!shortSha || subject === undefined || !committedAt) return null;
  return {
    shortSha,
    subject,
    committedAt: new Date(committedAt).toISOString(),
  };
};

/** One checkout's status: two git calls, read on request and never cached. */
export const readCheckoutStatus = async (
  cwd: string,
): Promise<CheckoutStatus> => {
  const { hasCommit, ...status } = parseStatusV2(
    await git(cwd, ["status", "--porcelain=v2", "--branch"]),
  );
  return {
    path: cwd,
    ...status,
    commit: hasCommit ? await readHeadCommit(cwd) : null,
  };
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const hasOriginRemote = async (cwd: string): Promise<boolean> =>
  (await gitOrNull(cwd, ["remote", "get-url", "origin"])) !== null;

/**
 * Whether to fetch before reading. `always`: the caller wants behind counted
 * against the remote as it is now. A sha: only when the upstream ref is not at
 * it (a pull request's head as GitHub reported it), so reading costs no network
 * call unless someone pushed. A branch with no upstream is never fetched: there
 * is nothing it would pull.
 */
export type CheckoutFetch = "always" | "never" | { unlessUpstreamAt: string };

const fetchFirst = async (
  cwd: string,
  fetch: CheckoutFetch,
): Promise<string | null> => {
  if (fetch === "never") return null;
  const upstreamSha = await gitOrNull(cwd, [
    "rev-parse",
    "--verify",
    "--quiet",
    "@{upstream}",
  ]);
  if (upstreamSha === null) return null;
  if (fetch !== "always" && upstreamSha.trim() === fetch.unlessUpstreamAt) {
    return null;
  }
  try {
    await git(cwd, ["fetch", "--quiet"], { network: true });
    return null;
  } catch (error) {
    return messageOf(error);
  }
};

export interface ReadCheckoutSyncParams {
  cwd: string;
  /** `never` unless set */
  fetch?: CheckoutFetch;
}

/** A failed fetch degrades: the status is then as of the previous one, and says why. */
export const readCheckoutSync = async ({
  cwd,
  fetch = "never",
}: ReadCheckoutSyncParams): Promise<CheckoutSyncResponse> => {
  const fetchError = await fetchFirst(cwd, fetch);
  const [status, hasOrigin] = await Promise.all([
    readCheckoutStatus(cwd),
    hasOriginRemote(cwd),
  ]);
  return { status, hasOrigin, fetchError };
};

/**
 * `--ff-only`: a pull that would need a merge or a rebase is a decision about
 * someone's branch, and git refuses it with the reason. A dirty checkout is left
 * to git too — it refuses only when an incoming change touches a modified file.
 * The refusal a surface hides the button on is thrown first, with its reason.
 */
export const pullCheckout = async (cwd: string): Promise<void> => {
  const refusal = pullRefusal(await readCheckoutStatus(cwd));
  if (refusal !== null) throw new Error(refusal);
  await git(cwd, ["pull", "--quiet", "--ff-only"], { network: true });
};

/**
 * Never `--force`: a rejected non-fast-forward comes back as git's reason. A
 * branch with no upstream is published to `origin` and starts tracking it, so
 * the next push and the ahead count both work from the same place.
 */
export const pushCheckout = async (cwd: string): Promise<void> => {
  const [status, hasOrigin] = await Promise.all([
    readCheckoutStatus(cwd),
    hasOriginRemote(cwd),
  ]);
  const refusal = pushRefusal(status, hasOrigin);
  if (refusal !== null) throw new Error(refusal);
  await git(
    cwd,
    status.upstream === null && status.branch !== null
      ? ["push", "--quiet", "--set-upstream", "origin", status.branch]
      : ["push", "--quiet"],
    { network: true },
  );
};
