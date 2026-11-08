import type {
  BranchPullRequest,
  BranchPullRequestCandidate,
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

/** GitHub's page: a branch is rarely the head of more, the newest kept first. */
const branchPullRequestsLimit = 20;
/** the commits read per pull request, enough to find the local tip among a branch's last ones */
const branchPullRequestCommitsLimit = 100;

const branchPullRequestsQuery = `query BranchPullRequests($owner: String!, $name: String!, $branch: String!, $first: Int!, $commits: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequests(headRefName: $branch, first: $first, orderBy: { field: UPDATED_AT, direction: DESC }) {
      nodes {
        number
        title
        state
        isDraft
        updatedAt
        mergedAt
        closedAt
        baseRefName
        headRefOid
        headRepository { nameWithOwner }
        author { login }
        commits(last: $commits) { nodes { commit { oid } } }
      }
    }
  }
}`;

interface BranchPullRequestNode {
  number: number;
  title: string;
  state: BranchPullRequest["state"];
  isDraft: boolean;
  updatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  baseRefName: string;
  headRefOid: string;
  headRepository: { nameWithOwner: string } | null;
  author: { login: string } | null;
  commits: { nodes: ({ commit: { oid: string } } | null)[] | null } | null;
}

export interface BranchPullRequestsData {
  repository: {
    pullRequests: { nodes: (BranchPullRequestNode | null)[] | null };
  } | null;
}

export const parseBranchPullRequests = (
  { data, errors }: GhGraphqlResult<BranchPullRequestsData>,
  ownerRepo: string,
): BranchPullRequestCandidate[] => {
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
    .map((node) => ({
      number: node.number,
      title: node.title,
      state: node.state,
      isDraft: node.isDraft,
      sha: node.headRefOid,
      baseRefName: node.baseRefName,
      author: node.author?.login ?? null,
      updatedAt: node.updatedAt,
      mergedAt: node.mergedAt,
      closedAt: node.closedAt,
      commitOids: (node.commits?.nodes ?? [])
        .filter((commitNode) => commitNode !== null)
        .map(({ commit }) => commit.oid),
    }));
};

/**
 * The pull requests whose head is a branch of this name in the repository,
 * open, merged or closed, a fork's left out: GitHub keeps each head commit
 * after the branch is deleted, which is what proves a squash-merged branch's
 * commits safe. One GraphQL request. A reused name brings its older pull
 * requests too: `linkBranchPullRequests` tells them apart.
 */
export const fetchBranchPullRequests = async (
  transport: GitHubTransport,
  ownerRepo: string,
  branch: string,
): Promise<BranchPullRequestCandidate[]> => {
  const split = splitOwnerRepo(ownerRepo);
  if (split === null) throw new Error(`${ownerRepo} is not owner/repo`);
  return parseBranchPullRequests(
    await transport.graphql<BranchPullRequestsData>(branchPullRequestsQuery, {
      owner: split.owner,
      name: split.name,
      branch,
      first: branchPullRequestsLimit,
      commits: branchPullRequestCommitsLimit,
    }),
    ownerRepo,
  );
};
