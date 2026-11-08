import {
  applyPullRequestEdit,
  fetchOpenPullRequests,
  fetchPullRequestCandidates,
  fetchPullRequestPart,
  fetchPullRequestRevisions,
  parsePullRequestEdit,
} from "@reviewflow/sdk";
import {
  createBindingsCache,
  pullCheckout,
  pushCheckout,
  readBranches,
  readCheckoutBranchDiff,
  readCheckoutSync,
  readCommitDiff,
  readFileAtSha,
  readHeadBranch,
  readImpacts,
  readPullRequestDiff,
  readReadingOrder,
  readRecentCommits,
  readWorktrees,
} from "@reviewflow/sdk/git";
import { appLogger } from "nightingale-app-console";
import type { PullRequestOperations } from "./routes.ts";

/** Parsed bindings by blob, kept for the life of the server: stepping through commits parses only what differs. */
const bindingsCache = createBindingsCache();

const editLogger = appLogger.child("edit", "Edit");

export const operations: PullRequestOperations = {
  fetchPullRequestPart,
  fetchPullRequestCandidates,
  fetchPullRequestRevisions,
  parsePullRequestEdit,
  editPullRequest: (transport, request) =>
    applyPullRequestEdit(transport, request, { logger: editLogger }),
  readPullRequestDiff,
  readFileAtSha,
  readReadingOrder,
  readImpacts: (request) => readImpacts({ ...request, cache: bindingsCache }),
  readHeadBranch,
  readCheckoutBranchDiff: ({ checkout, scope, whitespace }) =>
    readCheckoutBranchDiff({ cwd: checkout, scope, whitespace }),
  readRecentCommits: ({ checkout, limit }) =>
    readRecentCommits({ cwd: checkout, limit }),
  readCommitDiff: ({ checkout, sha, whitespace }) =>
    readCommitDiff({ cwd: checkout, sha, whitespace }),
  readCheckoutSync: ({ checkout, fetch }) =>
    readCheckoutSync({ cwd: checkout, fetch }),
  pullCheckout,
  pushCheckout,
  readWorktrees,
  readBranches: (checkout) => readBranches({ cwd: checkout }),
  fetchOpenPullRequests,
};
