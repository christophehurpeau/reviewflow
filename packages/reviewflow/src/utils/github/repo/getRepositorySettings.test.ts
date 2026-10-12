import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRepositorySettings } from "../../../events/pr-handlers/actions/utils/body/repositorySettings.ts";
import type { RepositorySettingsOctokit } from "./getRepositorySettings.ts";
import { fetchRepositorySettings } from "./getRepositorySettings.ts";

interface ClassicRule {
  requiresConversationResolution: boolean;
}

const createOctokit = ({
  classicRules = [],
  getBranchRules,
}: {
  classicRules?: ClassicRule[];
  getBranchRules: RepositorySettingsOctokit["rest"]["repos"]["getBranchRules"];
}): RepositorySettingsOctokit => ({
  graphql: vi.fn(() =>
    Promise.resolve({
      repository: {
        autoMergeAllowed: true,
        deleteBranchOnMerge: true,
        defaultBranchRef: { name: "main" },
        mergeCommitAllowed: true,
        rebaseMergeAllowed: true,
        squashMergeAllowed: true,
        branchProtectionRules: {
          nodes: classicRules.map((rule) => ({
            matchingRefs: { nodes: [{ name: "main" }] },
            requiresStatusChecks: true,
            ...rule,
          })),
        },
      },
    }),
  ) as RepositorySettingsOctokit["graphql"],
  rest: { repos: { getBranchRules } },
});

const noRules = () => Promise.resolve({ data: [] });
const threadResolutionRule = (required: boolean) => () =>
  Promise.resolve({
    data: [
      { type: "deletion" },
      {
        type: "pull_request",
        parameters: { required_review_thread_resolution: required },
      },
    ],
  });

describe("fetchRepositorySettings conversation resolution", (): void => {
  const nodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });
  afterEach(() => {
    process.env.NODE_ENV = nodeEnv;
  });

  const requiresConversationResolution = async (
    octokit: RepositorySettingsOctokit,
  ) =>
    createRepositorySettings(
      await fetchRepositorySettings(octokit, { owner: "o", repo: "r" }),
    ).defaultBranchProtectionRules?.requiresConversationResolution;

  test("classic branch protection", async () => {
    const octokit = createOctokit({
      classicRules: [{ requiresConversationResolution: true }],
      getBranchRules: noRules,
    });

    expect(await requiresConversationResolution(octokit)).toBe(true);
  });

  test("a ruleset with required_review_thread_resolution", async () => {
    const getBranchRules = vi.fn(threadResolutionRule(true));
    const octokit = createOctokit({ getBranchRules });

    expect(await requiresConversationResolution(octokit)).toBe(true);
    expect(getBranchRules).toHaveBeenCalledWith({
      owner: "o",
      repo: "r",
      branch: "main",
      per_page: 100,
    });
  });

  test("a ruleset that does not require it", async () => {
    const octokit = createOctokit({
      classicRules: [{ requiresConversationResolution: false }],
      getBranchRules: threadResolutionRule(false),
    });

    expect(await requiresConversationResolution(octokit)).toBe(false);
  });

  test("neither source gives no protection rules", async () => {
    const octokit = createOctokit({ getBranchRules: noRules });
    const settings = createRepositorySettings(
      await fetchRepositorySettings(octokit, { owner: "o", repo: "r" }),
    );

    expect(settings.defaultBranchProtectionRules).toBeNull();
  });

  test("a failing rulesets call counts as not required and is logged", async () => {
    const log = { error: vi.fn() };
    const octokit = createOctokit({
      classicRules: [{ requiresConversationResolution: false }],
      getBranchRules: () =>
        Promise.reject(new Error("Resource not accessible")),
    });

    const settings = createRepositorySettings(
      await fetchRepositorySettings(octokit, { owner: "o", repo: "r" }, log),
    );

    expect(settings.defaultBranchProtectionRules).toEqual(
      expect.objectContaining({ requiresConversationResolution: false }),
    );
    expect(log.error).toHaveBeenCalledTimes(1);
  });

  test("a failing rulesets call keeps the classic requirement", async () => {
    const octokit = createOctokit({
      classicRules: [{ requiresConversationResolution: true }],
      getBranchRules: () =>
        Promise.reject(new Error("Resource not accessible")),
    });

    expect(await requiresConversationResolution(octokit)).toBe(true);
  });
});
