import type { UnresolvedReviewThread } from "reviewflow-core";

export interface ReviewThreadsOctokit {
  graphql: <T>(
    query: string,
    parameters: Record<string, number | string | null>,
  ) => Promise<T>;
}

interface ReviewThreadsQueryResult {
  repository: {
    pullRequest: {
      reviewThreads: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: {
          isResolved: boolean;
          comments: {
            nodes: {
              databaseId: number | null;
              url: string;
              path: string;
              author: { login: string } | null;
            }[];
          };
        }[];
      };
    } | null;
  } | null;
}

const reviewThreadsQuery = `
query reviewThreads($owner: String!, $repo: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          isResolved
          comments(first: 1) {
            nodes {
              databaseId
              url
              path
              author {
                login
              }
            }
          }
        }
      }
    }
  }
}`;

export interface PullRequestRef {
  owner: string;
  repo: string;
  number: number;
}

/** every thread of the pull request still open, one call per 100 threads */
export const fetchUnresolvedReviewThreads = async (
  octokit: ReviewThreadsOctokit,
  { owner, repo, number }: PullRequestRef,
): Promise<UnresolvedReviewThread[]> => {
  const threads: UnresolvedReviewThread[] = [];
  let after: string | null = null;

  do {
    const result: ReviewThreadsQueryResult =
      await octokit.graphql<ReviewThreadsQueryResult>(reviewThreadsQuery, {
        owner,
        repo,
        number,
        after,
      });

    const reviewThreads = result.repository?.pullRequest?.reviewThreads;
    if (!reviewThreads) {
      throw new Error(`Pull request ${owner}/${repo}#${number} not found`);
    }

    for (const { isResolved, comments } of reviewThreads.nodes) {
      const root = comments.nodes[0];
      if (isResolved || !root || root.databaseId === null) continue;
      threads.push({
        rootCommentId: root.databaseId,
        url: root.url,
        path: root.path,
        authorLogin: root.author?.login ?? null,
      });
    }

    after = reviewThreads.pageInfo.hasNextPage
      ? reviewThreads.pageInfo.endCursor
      : null;
  } while (after !== null);

  return threads;
};
