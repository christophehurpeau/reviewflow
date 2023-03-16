import type { RepoContext } from '../../../../../context/repoContext';
import type { PullRequestWithDecentData } from '../../../utils/PullRequestData';
import type { ReviewflowPrContext } from '../../../utils/createPullRequestContext';

export type StepState = 'not-started' | 'in-progress' | 'failed' | 'passed';

export interface BaseStepState {
  state: StepState;
}

export interface CalcStepOptions<TeamNames extends string> {
  repoContext: RepoContext<TeamNames>;
  pullRequest: PullRequestWithDecentData;
  reviewflowPrContext: ReviewflowPrContext;
}
