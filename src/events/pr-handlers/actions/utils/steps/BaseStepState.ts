import type { RepoContext } from 'context/repoContext';
import type { PullRequestWithDecentData } from '../../../utils/PullRequestData';

export interface BaseStepState {
  pass: boolean;
}

export interface CalcStepOptions<GroupNames extends string> {
  repoContext: RepoContext<GroupNames>;
  pullRequest: PullRequestWithDecentData;
  labels: PullRequestWithDecentData['labels'];
}
