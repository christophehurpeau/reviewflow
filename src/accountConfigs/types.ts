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
  logins: string[];
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

export type GroupLabels =
  | 'needsReview'
  | 'requested'
  | 'changesRequested'
  | 'approved';

export type CiLabels = 'inProgress' | 'succeeded' | 'failed';

export type ReviewConfig<GroupNames extends string> = Record<
  GroupNames,
  Record<GroupLabels, string>
> &
  Record<'ci', Record<CiLabels, string>>;

export type LabelList = Record<string, LabelDescriptor>;

export interface LabelsConfig<GroupNames extends string> {
  list: LabelList;
  review: ReviewConfig<GroupNames>;
}

interface ExperimentalFeatures {
  lintPullRequestTitleWithConventionalCommit?: true;
}

interface WarnOnForcePushAfterReviewStarted {
  repositoryNames?: string[];
  message: string;
}

export interface Config<GroupNames extends string, TeamNames extends string> {
  autoAssignToCreator?: boolean;
  trimTitle?: boolean;
  ignoreRepoPattern?: string;
  requiresReviewRequest?: boolean;
  autoMergeRenovateWithSkipCi?: boolean;
  disableAutoMerge?: boolean;
  warnOnForcePushAfterReviewStarted?: WarnOnForcePushAfterReviewStarted;
  checksAllowedToFail?: string[];
  experimentalFeatures?: ExperimentalFeatures;
  parsePR?: ParsePR;
  prDefaultOptions: Options;

  botUsers?: string[];
  groups: Record<GroupNames, Group>;
  groupsGithubTeams?: Record<GroupNames, string[]>;
  teams: Record<TeamNames, Team>;
  waitForGroups?: Record<GroupNames, GroupNames[]>;

  labels: LabelsConfig<GroupNames>;
  defaultDmSettings?: Partial<Record<MessageCategory, boolean>>;
}
