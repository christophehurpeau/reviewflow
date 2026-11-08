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
import { errorMessage, log } from "./log.ts";
import type { PullRequestOperations } from "./routes.ts";

/** Parsed bindings by blob, kept for the life of the server: stepping through commits parses only what differs. */
const bindingsCache = createBindingsCache();

export const operations: PullRequestOperations = {
  fetchPullRequestPart,
  fetchPullRequestCandidates,
  fetchPullRequestRevisions,
  parsePullRequestEdit,
  editPullRequest: (transport, request) =>
    applyPullRequestEdit(transport, request, {
      logger: {
        warn: (message, context) => {
          log("warn", message, {
            context: { ...context, error: errorMessage(context.error) },
          });
        },
        error: (message, context) => {
          log("error", message, {
            context: { ...context, error: errorMessage(context.error) },
          });
        },
      },
    }),
  readPullRequestDiff,
  readFileAtSha,
  readReadingOrder,
  readImpacts: (request) => readImpacts({ ...request, cache: bindingsCache }),
};
