import type { RepoContext } from 'context/repoContext';
import type {
  PullRequestLabels,
  PullRequestWithDecentData,
} from '../../../utils/PullRequestData';

export type StepState = 'not-started' | 'in-progress' | 'failed' | 'passed';

export interface BaseStepState {
  state: StepState;
}

export interface CalcStepOptions<GroupNames extends string> {
  repoContext: RepoContext<GroupNames>;
  pullRequest: PullRequestWithDecentData;
  labels: PullRequestLabels;
}
