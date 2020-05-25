import { Octokit } from 'probot';
import { LabelResponse } from '../../../../context/initRepoLabels';

export default function hasLabelInPR(
  prLabels: Octokit.PullsGetResponse['labels'],
  label: LabelResponse,
): boolean {
  if (!label) return false;
  return prLabels.some((l): boolean => l.id === label.id);
}
