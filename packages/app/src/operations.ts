import {
  applyPullRequestEdit,
  fetchPullRequestCandidates,
  fetchPullRequestPart,
  fetchPullRequestRevisions,
  parsePullRequestEdit,
} from "@reviewflow/sdk";
import {
  createBindingsCache,
  readFileAtSha,
  readImpacts,
  readPullRequestDiff,
  readReadingOrder,
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
};
