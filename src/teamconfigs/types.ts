export interface StatusInfo {
  url?: string;
  title: string;
  summary: string;
}
export interface StatusError {
  title: string;
  summary: string;
}

export interface Group {
  [userName: string]: string;
}

export interface PrLintRule {
  bot?: false;
  regExp: RegExp;
  error: StatusError;

  status?: string;
  statusInfoFromMatch?: (match: RegExpMatchArray) => StatusInfo;
}

export interface PrLint {
  title: PrLintRule[];
}

export interface LabelDescriptor {
  name: string;
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

export interface Config<GroupNames extends string> {
  slackToken?: string;
  autoAssignToCreator?: boolean;
  trimTitle?: boolean;
  requiresReviewRequest?: boolean;
  prLint: PrLint;

  groups: Record<GroupNames, Group>;
  waitForGroups?: Record<GroupNames, GroupNames[]>;

  labels: LabelsConfig<GroupNames>;
}
