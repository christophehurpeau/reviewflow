import type { MessageCategory } from "../dm/MessageCategory";
import type { Options } from "../events/pr-handlers/actions/utils/body/prOptions";

export interface StatusInfo {
  type: "failure" | "pending" | "success";
  inBody?: true;
  url?: string;
  title: string;
  summary: string;
  details?: string;
}

export type Group = Record<string, string | null>;

export interface Team {
  githubTeamName?: string;
  labels?: string[];
}

interface PrInfo {
  title: string;
}

export interface ParsePRRule {
  bot?: false;
  regExp: RegExp;
  status?: string;
  createStatusInfo: (
    match: RegExpMatchArray | null,
    prInfo: PrInfo,
    isPrFromBot: boolean,
  ) => StatusInfo | null;
}

export interface ParsePR {
  title?: ParsePRRule[];
  body?: ParsePRRule[];
  head?: ParsePRRule[];
  base?: ParsePRRule[];
}

export interface LabelDescriptor {
  name: string;
  description?: string;
  color: string;
}

export type ReviewLabels =
  | "approved"
  | "changesRequested"
  | "needsReview"
  | "requested";

export type ReviewConfig = Record<ReviewLabels, string>;

export type LabelList = Record<string, LabelDescriptor>;

export interface LabelsConfig {
  legacyToRemove?: LabelList;
  list: LabelList;
  review?: ReviewConfig;
}

interface ExperimentalFeatures {
  conventionalCommitBangBreakingChange?: true;
  betterSlackify?: true;
  autoCloseAbandonedPrs?: true;
}

interface WarnOnForcePushAfterReviewStarted {
  repositoryNames?: string[];
  message: string;
}

export interface Config<TeamNames extends string> {
  autoAssignToCreator?: boolean;
  cleanTitle?: boolean | "conventionalCommit";
  lintPullRequestTitleWithConventionalCommit?: RegExp | boolean;
  ignoreRepoPattern?: string;
  requiresReviewRequest?: boolean;
  autoMergeRenovateWithSkipCi?: boolean;
  disableAutoMerge?: boolean;
  disableBypassMergeFor?: RegExp;
  warnOnForcePushAfterReviewStarted?: WarnOnForcePushAfterReviewStarted;
  checksAllowedToFail?: string[];
  onlyEnforceProgressWhenAutomergeEnabled?: boolean;
  experimentalFeatures?: ExperimentalFeatures;
  parsePR?: ParsePR;
  prDefaultOptions: Options;

  botUsers?: string[];
  teams: Record<TeamNames, Team>;

  labels: LabelsConfig;
  defaultDmSettings?: Partial<Record<MessageCategory, boolean>>;
}
