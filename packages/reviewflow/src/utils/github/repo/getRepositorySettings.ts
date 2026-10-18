import { Logger } from "nightingale-logger";
import type { Context } from "probot";
import type { RepositorySettingsQueryResult } from "reviewflow-core";

const logger = new Logger("reviewflow:getRepositorySettings");

export interface RepositoryRef {
  owner: string;
  repo: string;
}

export interface GraphqlOctokit {
  graphql: <T>(query: string, parameters: Record<string, string>) => Promise<T>;
}

interface BranchRule {
  type: string;
  parameters?: object;
}

export interface RepositorySettingsOctokit extends GraphqlOctokit {
  rest: {
    repos: {
      getBranchRules: (parameters: {
        owner: string;
        repo: string;
        branch: string;
        per_page: number;
      }) => Promise<{ data: BranchRule[] }>;
    };
  };
}

const repositorySettingsQuery = `
query repository($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    autoMergeAllowed
    deleteBranchOnMerge
    defaultBranchRef {
      name
    }
    mergeCommitAllowed
    rebaseMergeAllowed
    squashMergeAllowed
    branchProtectionRules (first: 100) {
      nodes {
        matchingRefs (first: 100) {
          nodes {
            name
          }
        }
        requiresStatusChecks
        requiresConversationResolution
      }
    }
  }
}`;

const testRepositorySettings: RepositorySettingsQueryResult = {
  repository: {
    autoMergeAllowed: true,
    deleteBranchOnMerge: true,
    defaultBranchRef: { name: "main" },
    mergeCommitAllowed: true,
    rebaseMergeAllowed: true,
    squashMergeAllowed: true,
    branchProtectionRules: {
      nodes: [
        {
          matchingRefs: { nodes: [{ name: "main" }] },
          requiresStatusChecks: true,
          requiresConversationResolution: false,
          // requiredStatusChecks: [
          //   { app: null, context: "reviewflow" },
          //   {
          //     app: { id: "MDM6QXBwMTUzNjg=", name: "GitHub Actions" },
          //     context: "test (18)",
          //   },
          // ],
        },
      ],
    },
  },
  rulesets: { requiresConversationResolution: false },
};

export interface RepositorySettingsLog {
  error: (details: object, message: string) => void;
}

const loggerLog: RepositorySettingsLog = {
  error: (details, message) => {
    logger.error(message, { ...details });
  },
};

const fetchRulesetsRequireConversationResolution = async (
  octokit: RepositorySettingsOctokit,
  { owner, repo, branch }: RepositoryRef & { branch: string },
  log: RepositorySettingsLog,
): Promise<boolean> => {
  try {
    const { data: rules } = await octokit.rest.repos.getBranchRules({
      owner,
      repo,
      branch,
      per_page: 100,
    });
    return rules.some(
      (rule) =>
        rule.type === "pull_request" &&
        !!rule.parameters &&
        "required_review_thread_resolution" in rule.parameters &&
        rule.parameters.required_review_thread_resolution === true,
    );
  } catch (error) {
    log.error(
      { error, owner, repo, branch },
      "failed to read the branch rules, conversation resolution counts as not required",
    );
    return false;
  }
};

export const fetchRepositorySettings = async (
  octokit: RepositorySettingsOctokit,
  { owner, repo }: RepositoryRef,
  log: RepositorySettingsLog = loggerLog,
): Promise<RepositorySettingsQueryResult> => {
  if (process.env.NODE_ENV === "test") {
    return testRepositorySettings;
  }
  const { repository } = await octokit.graphql<
    Pick<RepositorySettingsQueryResult, "repository">
  >(repositorySettingsQuery, { owner, repo });
  const requiresConversationResolution =
    await fetchRulesetsRequireConversationResolution(
      octokit,
      { owner, repo, branch: repository.defaultBranchRef.name },
      log,
    );
  return { repository, rulesets: { requiresConversationResolution } };
};

export const getRepositorySettings = (
  context: Context,
): Promise<RepositorySettingsQueryResult> =>
  fetchRepositorySettings(context.octokit, context.repo(), context.log);

// not allowed
/*
requiredStatusChecks {
          app { id, name }
          context
        }
        */
