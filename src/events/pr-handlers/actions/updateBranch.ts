import type { EmitterWebhookEventName } from "@octokit/webhooks";
import type { ProbotEvent } from "../../probot-types";
import type { PullRequestWithDecentData } from "../utils/PullRequestData";

export const updateBranch = async <Name extends EmitterWebhookEventName>(
  pullRequest: PullRequestWithDecentData,
  context: ProbotEvent<Name>,
  login: string | null,
): Promise<boolean> => {
  const repo = pullRequest.head.repo;
  if (!repo) return false;

  context.log.info("update branch", {
    head: pullRequest.head.ref,
    base: pullRequest.base.ref,
  });

  const result = await context.octokit.repos
    .merge({
      owner: repo.owner.login,
      repo: repo.name,
      head: pullRequest.base.ref,
      base: pullRequest.head.ref,
    })
    .catch((error: unknown) => ({ error }) as any);

  context.log.info(
    {
      status: result.status,
      sha: result.data?.sha,
      error: result.error,
    },
    "update branch result",
  );

  if (result.status === 204 || result.error?.status === 204) {
    context.octokit.issues.createComment(
      context.repo({
        issue_number: pullRequest.number,
        body: `${
          login ? `@${login} ` : ""
        }Could not update branch: base already contains the head, nothing to merge.`,
      }),
    );
    return true;
  } else if (result.status === 409 || result.error?.status === 409) {
    context.octokit.issues.createComment(
      context.repo({
        issue_number: pullRequest.number,
        body: `${
          login ? `@${login} ` : ""
        }Could not update branch: merge conflict. Please resolve manually.`,
      }),
    );
    return false;
  } else if (!result?.data?.sha) {
    context.octokit.issues.createComment(
      context.repo({
        issue_number: pullRequest.number,
        body: `${login ? `@${login} ` : ""}Could not update branch ${
          result?.error?.response?.data?.message ??
          `(unknown error${
            result?.error.status ? `, status = ${result.error.status}` : ""
          })`
        }.`,
      }),
    );
    return false;
  } else if (login) {
    context.octokit.issues.createComment(
      context.repo({
        issue_number: pullRequest.number,
        body: `${login ? `@${login} ` : ""}Branch updated: ${result.data.sha}`,
      }),
    );
  }
  return true;
};
