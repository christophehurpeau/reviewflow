import type {
  PullRequestCheck,
  PullRequestCheckOutcome,
} from "../api/pullRequest.ts";

export type ChecksSummary = Record<PullRequestCheckOutcome, number>;

/**
 * How many of `checks` passed, failed and have not finished: a running check
 * counts as pending. Counts only the checks listed, so past the first page
 * `checksTotal` minus their sum is what was not read.
 */
export const checksSummary = (
  checks: readonly Pick<PullRequestCheck, "outcome">[],
): ChecksSummary => {
  const summary: ChecksSummary = { failed: 0, passed: 0, pending: 0 };
  for (const { outcome } of checks) summary[outcome] += 1;
  return summary;
};
