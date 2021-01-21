import type { MessageCategory } from '../dm/MessageCategory';
import type { Options } from '../events/pr-handlers/actions/utils/body/prOptions';

export interface StatusInfo {
  inBody?: true;
  url?: string;
  title: string;
  summary: string;
}
export interface StatusError {
  title: string;
  summary: string;
}

export interface Group {
  [userName: string]: string | null;
}

export interface Team {
  githubTeamSlug?: string;
  logins: string[];
  labels?: string[];
}

export interface ParsePRRule {
  bot?: false;
  regExp: RegExp;
  error: StatusError;

  status?: string;
  statusInfoFromMatch?: (match: RegExpMatchArray) => StatusInfo;
}

export interface ParsePR {
  title: ParsePRRule[];
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

export interface LabelsConfig<GroupNames extends string> {
  list: Record<string, LabelDescriptor>;
  review: ReviewConfig<GroupNames>;
}

export interface Config<GroupNames extends string, TeamNames extends string> {
  autoAssignToCreator?: boolean;
  trimTitle?: boolean;
  ignoreRepoPattern?: string;
  requiresReviewRequest?: boolean;
  autoMergeRenovateWithSkipCi?: boolean;
  parsePR: ParsePR;
  prDefaultOptions: Options;

  botUsers?: string[];
  groups: Record<GroupNames, Group>;
  teams: Record<TeamNames, Team>;
  waitForGroups?: Record<GroupNames, GroupNames[]>;

  labels: LabelsConfig<GroupNames>;
  defaultDmSettings?: Partial<Record<MessageCategory, boolean>>;
}
