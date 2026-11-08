import type { PullRequestChecksResponse } from "../api/pullRequest.ts";
import type { GhPullRequestChecks } from "../github/pullRequestDetail.ts";
import { parsePullRequestChecks } from "../github/pullRequestDetail.ts";
import type { ReviewflowCheckRun, ReviewflowCommitStatus } from "./client.ts";

const upperOrNull = (value: string | null): string | null =>
  value === null ? null : value.toUpperCase();

/**
 * reviewflow's copy of the head's checks, read as GitHub's are: its values are
 * the REST api's, lowercase where GraphQL's are uppercase. A run stored before
 * reviewflow kept its status reads as completed when it has a conclusion.
 *
 * The runs are rebuilt as the GraphQL contexts and handed to
 * `parsePullRequestChecks`, so the outcome mapping and the ordering stay the
 * one GitHub-read checks use.
 */
export const checksFromReviewflow = (
  {
    checkRuns,
    statuses,
  }: {
    checkRuns: ReviewflowCheckRun[];
    statuses: ReviewflowCommitStatus[];
  },
  at: string,
): PullRequestChecksResponse => {
  const nodes: NonNullable<
    NonNullable<
      NonNullable<GhPullRequestChecks["headCommits"]["nodes"]>[number]
    >["commit"]["statusCheckRollup"]
  >["contexts"]["nodes"] = [
    ...checkRuns.map((run) => ({
      __typename: "CheckRun" as const,
      name: run.name,
      status:
        upperOrNull(run.status) ??
        (run.conclusion === null ? "QUEUED" : "COMPLETED"),
      conclusion: upperOrNull(run.conclusion),
      title: run.title,
      detailsUrl: run.detailsUrl,
    })),
    ...statuses.map((status) => ({
      __typename: "StatusContext" as const,
      context: status.context,
      state: status.state.toUpperCase(),
      description: status.description,
      targetUrl: status.targetUrl,
    })),
  ];
  const parsed = parsePullRequestChecks({
    data: {
      repository: {
        pullRequest: {
          headCommits: {
            nodes: [
              {
                commit: {
                  statusCheckRollup: {
                    contexts: { totalCount: nodes.length, nodes },
                  },
                },
              },
            ],
          },
        },
      },
    },
    errors: [],
    ownerRepo: "",
    number: 0,
    fetchedAt: at,
  });
  return { ...parsed, source: "reviewflow" };
};
