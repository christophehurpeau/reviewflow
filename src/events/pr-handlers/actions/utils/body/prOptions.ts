import type { RepoContext } from "../../../../../context/repoContext.ts";
import type { PullRequestLabels } from "../../../utils/PullRequestData.ts";
import hasLabelInPR from "../labels/hasLabelInPR.ts";
import type { RepositorySettings } from "./repositorySettings.ts";

export type OptionsKeys =
  | "autoMerge"
  | "autoMergeWithSkipCi"
  | "deleteAfterMerge";

export type Options = Record<OptionsKeys, boolean>;

export const options: OptionsKeys[] = [
  "autoMerge",
  "autoMergeWithSkipCi",
  "deleteAfterMerge",
];
export const optionsRegexps: {
  key: OptionsKeys;
  regexp: RegExp;
}[] = options.map((option) => ({
  key: option,
  regexp: new RegExp(`\\[([ xX]?)]\\s*<!-- reviewflow-${option} -->`),
}));

interface OptionDisplay {
  key: OptionsKeys;
  labelKey?: string;
  icon?: string;
  description: string;
  shouldAllow?: (settings: RepositorySettings) => boolean;
  legacy?: {
    repositorySettingKey: keyof RepositorySettings;
    legacyMessage?: string;
  };
}

export const optionsDescriptions: OptionDisplay[] = [
  {
    key: "autoMerge",
    labelKey: "merge/automerge",
    description:
      "Automatically merge when this PR is ready and has no failed statuses. When the repository requires _branches to be up to date before merging_, it merges default branch, with a queue per repo to prevent multiple merges when several PRs are ready. A fail job prevents the merge.",
    shouldAllow: ({ defaultBranchProtectionRules, allowAutoMerge }) =>
      (allowAutoMerge &&
        defaultBranchProtectionRules?.requiresStatusChecks !== false) ||
      false,
    // requiredStatusChecks.find(    ({ context }) => context === "reviewflow"      ),
  },
  {
    key: "autoMergeWithSkipCi",
    labelKey: "merge/skip-ci",
    description:
      "Add `[skip ci]` on merge commit when merge is done with autoMerge.",
  },
  {
    key: "deleteAfterMerge",
    icon: ":recycle:",
    description: "Automatically delete the branch after this PR is merged.",
    legacy: {
      repositorySettingKey: "deleteBranchOnMerge",
      legacyMessage:
        "[Delete branch with Github Setting](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-the-automatic-deletion-of-branches)",
    },
  },
];

export const calcDefaultOptions = (
  repoContext: RepoContext,
  pullRequestLabels: PullRequestLabels,
): Options => {
  const automergeLabel = repoContext.labels["merge/automerge"];
  const skipCiLabel = repoContext.labels["merge/skip-ci"];

  const prHasSkipCiLabel = hasLabelInPR(pullRequestLabels, skipCiLabel);
  const prHasAutoMergeLabel = hasLabelInPR(pullRequestLabels, automergeLabel);

  return {
    ...repoContext.config.prDefaultOptions,
    autoMergeWithSkipCi: prHasSkipCiLabel,
    autoMerge: prHasAutoMergeLabel,
  };
};
