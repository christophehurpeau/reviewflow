import type { EmitterWebhookEventName } from '@octokit/webhooks';
import type { PullRequestWithDecentData } from 'events/pr-handlers/utils/PullRequestData';
import type { ProbotEvent } from 'events/probot-types';
import type { LabelResponse } from '../../../../context/initRepoLabels';
import hasLabelInPR from './hasLabelInPR';

interface SyncLabelOptions {
  onRemove?: () => void | Promise<void>;
  onAdd?: (prLabels: LabelResponse[]) => void | Promise<void>;
}

export default async function syncLabel<
  EventName extends EmitterWebhookEventName,
>(
  pullRequest: PullRequestWithDecentData,
  context: ProbotEvent<EventName>,
  shouldHaveLabel: boolean,
  label: LabelResponse,
  prHasLabel = hasLabelInPR(pullRequest.labels, label),
  { onRemove, onAdd }: SyncLabelOptions = {},
): Promise<void> {
  if (prHasLabel && !shouldHaveLabel) {
    await context.octokit.issues.removeLabel(
      context.issue({ name: label.name }),
    );
    if (onRemove) await onRemove();
  }
  if (shouldHaveLabel && !prHasLabel) {
    const response = await context.octokit.issues.addLabels(
      context.issue({ labels: [label.name] }),
    );
    if (onAdd) await onAdd(response.data);
  }
}
