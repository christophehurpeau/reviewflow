import {
  applyPullRequestEdit,
  fetchBranchPullRequests,
  fetchOpenPullRequests,
  fetchPullRequestCandidates,
  fetchPullRequestPart,
  fetchPullRequestRevisions,
  parsePullRequestEdit,
} from "@reviewflow/sdk";
import {
  listCheckoutFiles,
  readCheckoutFile,
  readCheckoutFileAtHead,
  saveCheckoutFile,
} from "@reviewflow/sdk/files";
import {
  completeWorktreeRemoval,
  createBindingsCache,
  linkBranchPullRequests,
  listWorktrees,
  prepareWorktreeRemoval,
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
  readWorktreeRemovalStatus,
  readWorktreeStatuses,
  watchCheckout,
} from "@reviewflow/sdk/git";
import { appLogger } from "nightingale-app-console";
import { cloneWithGh } from "./clone.ts";
import type { PullRequestOperations } from "./routes.ts";

/** Parsed bindings by blob, kept for the life of the server: stepping through commits parses only what differs. */
const bindingsCache = createBindingsCache();

const editLogger = appLogger.child("edit", "Edit");
const cloneLogger = appLogger.child("clone", "Clone");

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
  readCheckoutBranchDiff: ({ checkout, scope, whitespace, branch }) =>
    readCheckoutBranchDiff({ cwd: checkout, scope, whitespace, branch }),
  readRecentCommits: ({ checkout, limit, branch }) =>
    readRecentCommits({ cwd: checkout, limit, branch }),
  readCommitDiff: ({ checkout, sha, whitespace }) =>
    readCommitDiff({ cwd: checkout, sha, whitespace }),
  readCheckoutSync: ({ checkout, fetch }) =>
    readCheckoutSync({ cwd: checkout, fetch }),
  pullCheckout,
  pushCheckout,
  listWorktrees,
  readWorktreeStatuses,
  readBranches: (checkout) => readBranches({ cwd: checkout }),
  fetchOpenPullRequests,
  fetchBranchPullRequests,
  linkBranchPullRequests: ({ checkout, ...params }) =>
    linkBranchPullRequests({ cwd: checkout, ...params }),
  readWorktreeRemovalStatus,
  prepareWorktreeRemoval,
  completeWorktreeRemoval,
  listCheckoutFiles,
  readCheckoutFile,
  readCheckoutFileAtHead,
  saveCheckoutFile,
  watchCheckout,
  cloneRepository: async (plan) => {
    cloneLogger.info("cloning", { ...plan });
    try {
      await cloneWithGh(plan);
    } catch (error) {
      cloneLogger.warn("clone failed", { ...plan, error });
      throw error;
    }
    cloneLogger.success("cloned", { ...plan });
  },
};
