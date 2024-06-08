import type { RestEndpointMethodTypes } from "@octokit/rest";
import type { EmitterWebhookEventName } from "@octokit/webhooks";
import type { ProbotEvent } from "../../probot-types";

export type CommitFromRestEndpoint =
  RestEndpointMethodTypes["repos"]["getCommit"]["response"]["data"];

export const fetchCommit = async <T extends EmitterWebhookEventName>(
  context: ProbotEvent<T>,
  ref: string,
): Promise<CommitFromRestEndpoint> => {
  const commitResult = await context.octokit.repos.getCommit(
    context.repo({ ref }),
  );
  return commitResult.data;
};
