import type { Context } from "probot";

export interface AutoMergeRequest {
  enabledAt?: string;
  enabledBy: {
    login: string;
  };
}

export interface EnablePullRequestAutoMergeParams {
  pullRequestId: string;
  mergeMethod: "SQUASH";
  commitHeadline: string;
  commitBody: string;
}

export interface EnablePullRequestAutoMergeResponse {
  enablePullRequestAutoMerge: {
    pullRequest: {
      autoMergeRequest: AutoMergeRequest;
    };
  };
}

export const enableGithubAutoMergeMutation = (
  context: Context,
  params: EnablePullRequestAutoMergeParams,
): Promise<EnablePullRequestAutoMergeResponse> => {
  return context.octokit.graphql<EnablePullRequestAutoMergeResponse>(
    `mutation EnableGithubAutoMergeMutation($pullRequestId: ID!, $mergeMethod: PullRequestMergeMethod!, $commitHeadline: String!, $commitBody: String!) {
      enablePullRequestAutoMerge(input: {
        pullRequestId: $pullRequestId,
        mergeMethod: $mergeMethod,
        commitHeadline: $commitHeadline,
        commitBody: $commitBody
      }) {
        pullRequest {
          autoMergeRequest {
            enabledAt
            enabledBy {
              login
            }
          }
        }
      }
    }`,
    params as any,
  );
};

export interface DisablePullRequestAutoMergeParams {
  pullRequestId: string;
}

export interface DisablePullRequestAutoMergeResponse {
  disablePullRequestAutoMerge: {
    pullRequest: {
      autoMergeRequest: null;
    };
  };
}
export const disableGithubAutoMergeMutation = (
  context: Context,
  params: DisablePullRequestAutoMergeParams,
): Promise<DisablePullRequestAutoMergeResponse> => {
  return context.octokit.graphql<DisablePullRequestAutoMergeResponse>(
    `mutation DisableGithubAutoMergeMutation($pullRequestId: ID!) {
      disablePullRequestAutoMerge(input: {
        pullRequestId: $pullRequestId
      }) {
        pullRequest {
          autoMergeRequest {
            enabledAt
            enabledBy {
              login
            }
          }
        }
      }
    }`,
    params as any,
  );
};
