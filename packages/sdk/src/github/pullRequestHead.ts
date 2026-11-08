import type { PullRequestRef } from "../api/pullRequest.ts";
import type { GitHubTransport } from "./transport.ts";

export const pullRequestHeadQuery = `query PullRequestHead($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      state
      headRefName
      isCrossRepository
      headRepositoryOwner { login }
    }
  }
}`;

export interface PullRequestHeadData {
  repository: {
    pullRequest: {
      state: "CLOSED" | "MERGED" | "OPEN";
      headRefName: string;
      isCrossRepository: boolean;
      headRepositoryOwner: { login: string } | null;
    } | null;
  } | null;
}

type GhPullRequestState = NonNullable<
  NonNullable<PullRequestHeadData["repository"]>["pullRequest"]
>["state"];

export interface PullRequestHead {
  state: "closed" | "merged" | "open";
  branch: string;
  /** the head repository's owner when it is a fork, null when the branch is on origin */
  fork: string | null;
}

const headStates: Record<GhPullRequestState, PullRequestHead["state"]> = {
  CLOSED: "closed",
  MERGED: "merged",
  OPEN: "open",
};

/** Raises with GitHub's reason when the pull request is not one the token can read. */
export const fetchPullRequestHead = async (
  transport: GitHubTransport,
  { ownerRepo, number }: PullRequestRef,
): Promise<PullRequestHead> => {
  const [owner = "", name = ""] = ownerRepo.split("/");
  const { data, errors } = await transport.graphql<PullRequestHeadData>(
    pullRequestHeadQuery,
    { owner, name, number },
  );
  const pullRequest = data?.repository?.pullRequest ?? null;
  if (pullRequest === null) {
    const reason = errors.length > 0 ? errors.join("; ") : "not found";
    throw new Error(`${ownerRepo}#${String(number)}: ${reason}`);
  }
  return {
    state: headStates[pullRequest.state],
    branch: pullRequest.headRefName,
    fork: pullRequest.isCrossRepository
      ? (pullRequest.headRepositoryOwner?.login ?? "a deleted fork")
      : null,
  };
};
