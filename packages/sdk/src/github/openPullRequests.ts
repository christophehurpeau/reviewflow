import type {
  BranchPullRequestHead,
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

const branchPullRequestsQuery = `query BranchPullRequests($owner: String!, $name: String!, $branch: String!) {
  repository(owner: $owner, name: $name) {
    pullRequests(headRefName: $branch, first: 20, orderBy: { field: UPDATED_AT, direction: DESC }) {
      nodes {
        number
        state
        headRefOid
        headRepository { nameWithOwner }
      }
    }
  }
}`;

interface BranchPullRequestNode {
  number: number;
  state: BranchPullRequestHead["state"];
  headRefOid: string;
  headRepository: { nameWithOwner: string } | null;
}

export interface BranchPullRequestsData {
  repository: {
    pullRequests: { nodes: (BranchPullRequestNode | null)[] | null };
  } | null;
}

export const parseBranchPullRequestHeads = (
  { data, errors }: GhGraphqlResult<BranchPullRequestsData>,
  ownerRepo: string,
): BranchPullRequestHead[] => {
  const connection = data?.repository?.pullRequests ?? null;
  if (connection === null) {
    throw new Error(errors.length > 0 ? errors.join("; ") : "not found");
  }
  return (connection.nodes ?? [])
    .filter((node) => node !== null)
    .filter(
      (node) =>
        node.headRepository?.nameWithOwner.toLowerCase() ===
        ownerRepo.toLowerCase(),
    )
    .map(({ number, state, headRefOid }) => ({
      number,
      state,
      sha: headRefOid,
    }));
};

/**
 * The pull requests whose head is this branch of the repository, open, merged
 * or closed: GitHub keeps each head commit after the branch is deleted, which
 * is what proves a squash-merged branch's commits safe. One GraphQL request.
 */
export const fetchBranchPullRequestHeads = async (
  transport: GitHubTransport,
  ownerRepo: string,
  branch: string,
): Promise<BranchPullRequestHead[]> => {
  const split = splitOwnerRepo(ownerRepo);
  if (split === null) throw new Error(`${ownerRepo} is not owner/repo`);
  return parseBranchPullRequestHeads(
    await transport.graphql<BranchPullRequestsData>(branchPullRequestsQuery, {
      owner: split.owner,
      name: split.name,
      branch,
    }),
    ownerRepo,
  );
};
