import { PullsGetResponse } from '@octokit/rest';
import { LabelResponse } from '../../../context/initRepoLabels';

export default function hasLabelInPR(
  pr: PullsGetResponse,
  label: LabelResponse,
): boolean {
  if (!label) return false;
  return pr.labels.some((l): boolean => l.id === label.id);
}
