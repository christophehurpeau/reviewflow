import type { PullRequestDetailResponse } from "@reviewflow/sdk";

/** GitHub lets the author comment on their pull request, never review it. */
export const isViewerAuthor = ({
  pullRequest,
  viewer,
}: PullRequestDetailResponse): boolean => pullRequest.author?.login === viewer;
