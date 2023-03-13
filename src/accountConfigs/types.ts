import type { MessageCategory } from '../dm/MessageCategory';
import type { Options } from '../events/pr-handlers/actions/utils/body/prOptions';

export interface StatusInfo {
  type: 'success' | 'failure';
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
  | 'needsReview'
  | 'requested'
  | 'changesRequested'
  | 'approved';

export type ReviewConfig = Record<ReviewLabels, string>;

export type LabelList = Record<string, LabelDescriptor>;

export interface LabelsConfig {
  legacyToRemove?: LabelList;
  list: LabelList;
  review?: ReviewConfig;
}

interface ExperimentalFeatures {
  lintPullRequestTitleWithConventionalCommit?: true;
  conventionalCommitBangBreakingChange?: true;
}

interface WarnOnForcePushAfterReviewStarted {
  repositoryNames?: string[];
  message: string;
}

export interface Config<TeamNames extends string> {
  autoAssignToCreator?: boolean;
  trimTitle?: boolean;
  ignoreRepoPattern?: string;
  requiresReviewRequest?: boolean;
  autoMergeRenovateWithSkipCi?: boolean;
  disableAutoMerge?: boolean;
  disableBypassMergeFor?: RegExp;
  warnOnForcePushAfterReviewStarted?: WarnOnForcePushAfterReviewStarted;
  checksAllowedToFail?: string[];
  experimentalFeatures?: ExperimentalFeatures;
  parsePR?: ParsePR;
  prDefaultOptions: Options;

  botUsers?: string[];
  teams: Record<TeamNames, Team>;

  labels: LabelsConfig;
  defaultDmSettings?: Partial<Record<MessageCategory, boolean>>;
}
