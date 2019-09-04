import { PullsGetResponse } from '@octokit/rest';
import { LabelResponse } from '../../../context/initRepoLabels';

export default function hasLabelInPR(
  prLabels: PullsGetResponse['labels'],
  label: LabelResponse,
): boolean {
  if (!label) return false;
  return prLabels.some((l): boolean => l.id === label.id);
}
