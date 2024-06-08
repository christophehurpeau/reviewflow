import type { LabelResponse } from "../../../../../context/initRepoLabels";
import type { PullRequestLabels } from "../../../utils/PullRequestData";

export default function hasLabelInPR(
  prLabels: PullRequestLabels,
  label: LabelResponse,
): boolean {
  if (!label) return false;
  return prLabels.some((l): boolean => l.id === label.id);
}
