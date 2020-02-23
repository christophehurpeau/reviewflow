import Webhooks from '@octokit/webhooks';
import { Context, Octokit } from 'probot';
import { LabelResponse } from '../../../context/initRepoLabels';
import hasLabelInPR from './hasLabelInPR';

interface SyncLabelOptions {
  onRemove?: () => void | Promise<void>;
  onAdd?: (prLabels: LabelResponse[]) => void | Promise<void>;
}

export default async function syncLabel<
  T extends Webhooks.WebhookPayloadPullRequest
>(
  pr: Octokit.PullsGetResponse,
  context: Context<T>,
  shouldHaveLabel: boolean,
  label: LabelResponse,
  prHasLabel = hasLabelInPR(pr.labels, label),
  { onRemove, onAdd }: SyncLabelOptions = {},
): Promise<void> {
  if (prHasLabel && !shouldHaveLabel) {
    await context.github.issues.removeLabel(
      context.issue({ name: label.name }),
    );
    if (onRemove) await onRemove();
  }
  if (shouldHaveLabel && !prHasLabel) {
    const response = await context.github.issues.addLabels(
      context.issue({ labels: [label.name] }),
    );
    if (onAdd) await onAdd(response.data);
  }
}
