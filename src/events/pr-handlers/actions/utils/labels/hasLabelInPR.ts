import type { PullRequestLabels } from 'events/pr-handlers/utils/PullRequestData';
import type { LabelResponse } from '../../../../../context/initRepoLabels';

export default function hasLabelInPR(
  prLabels: PullRequestLabels,
  label: LabelResponse,
): boolean {
  if (!label) return false;
  return prLabels.some((l): boolean => l.id === label.id);
}
