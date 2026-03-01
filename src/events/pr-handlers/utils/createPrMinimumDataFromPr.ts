import type {
  PullRequestData,
  PullRequestDataMinimumData,
} from "./PullRequestData";

export const createPrMinimumDataFromPr = (
  pullRequest: PullRequestData,
): PullRequestDataMinimumData => ({
  number: pullRequest.number,
  // branch: pullRequest.head.ref,
});
