import type {
  OpenPullRequest,
  OpenPullRequestsResponse,
} from "../checkout/overview.ts";
import { splitOwnerRepo } from "./prQuery.ts";
import type { GhGraphqlResult, GitHubTransport } from "./transport.ts";

/** One page of GitHub's maximum: a repository with more open shows a count of the rest. */
const openPullRequestsLimit = 100;

const openPullRequestsQuery = `query OpenPullRequests($owner: String!, $name: String!, $first: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequests(states: OPEN, first: $first, orderBy: { field: UPDATED_AT, direction: DESC }) {
      totalCount
      nodes {
        number
        title
        isDraft
        updatedAt
        headRefName
        headRepository { nameWithOwner }
        author { login }
      }
    }
  }
}`;

interface OpenPullRequestNode {
  number: number;
  title: string;
  isDraft: boolean;
  updatedAt: string;
  headRefName: string;
  headRepository: { nameWithOwner: string } | null;
  author: { login: string } | null;
}

export interface OpenPullRequestsData {
  repository: {
    pullRequests: {
      totalCount: number;
      nodes: (OpenPullRequestNode | null)[] | null;
    };
  } | null;
}

export const parseOpenPullRequests = ({
  data,
  errors,
}: GhGraphqlResult<OpenPullRequestsData>): OpenPullRequestsResponse => {
  const connection = data?.repository?.pullRequests ?? null;
  if (connection === null) {
    throw new Error(errors.length > 0 ? errors.join("; ") : "not found");
  }
  const pullRequests = (connection.nodes ?? [])
    .filter((node) => node !== null)
    .map((node): OpenPullRequest => ({
      number: node.number,
      title: node.title,
      isDraft: node.isDraft,
      headRefName: node.headRefName,
      headOwnerRepo: node.headRepository?.nameWithOwner ?? null,
      author: node.author?.login ?? null,
      updatedAt: node.updatedAt,
    }));
  return { pullRequests, totalCount: connection.totalCount };
};

/** The repository's open pull requests, most recently updated first: one GraphQL request. */
export const fetchOpenPullRequests = async (
  transport: GitHubTransport,
  ownerRepo: string,
): Promise<OpenPullRequestsResponse> => {
  const split = splitOwnerRepo(ownerRepo);
  if (split === null) throw new Error(`${ownerRepo} is not owner/repo`);
  return parseOpenPullRequests(
    await transport.graphql<OpenPullRequestsData>(openPullRequestsQuery, {
      owner: split.owner,
      name: split.name,
      first: openPullRequestsLimit,
    }),
  );
};
