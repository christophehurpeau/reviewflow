import type {
  PullRequestData,
  PullRequestDataMinimumData,
} from "./PullRequestData";

export const createPrMinimumDataFromPr = (
  pullRequest: PullRequestData,
): PullRequestDataMinimumData => ({
  id: pullRequest.id,
  number: pullRequest.number,
  // branch: pullRequest.head.ref,
});
