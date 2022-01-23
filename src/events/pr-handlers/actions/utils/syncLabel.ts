import type { EmitterWebhookEventName } from '@octokit/webhooks';
import type { SetRequired } from 'type-fest';
import type { PullRequestWithDecentData } from 'events/pr-handlers/utils/PullRequestData';
import type { ProbotEvent } from 'events/probot-types';
import type { LabelResponse } from '../../../../context/initRepoLabels';
import hasLabelInPR from './hasLabelInPR';

type SyncLabelCallback = (prLabels: LabelResponse[]) => void | Promise<void>;

interface SyncLabelOptions {
  onRemove?: SyncLabelCallback;
  onAdd?: SyncLabelCallback;
}

/** @deprecated use syncLabels instead */
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
    const response = await context.octokit.issues.removeLabel(
      context.issue({ name: label.name }),
    );
    if (onRemove) await onRemove(response.data);
  }
  if (shouldHaveLabel && !prHasLabel) {
    const response = await context.octokit.issues.addLabels(
      context.issue({ labels: [label.name] }),
    );
    if (onAdd) await onAdd(response.data);
  }
}

export const removeLabel = async <EventName extends EmitterWebhookEventName>(
  context: ProbotEvent<EventName>,
  label: LabelResponse,
): Promise<LabelResponse[]> => {
  const response = await context.octokit.issues.removeLabel(
    context.issue({ name: label.name }),
  );
  return response.data;
};

interface LabelToSync extends SyncLabelOptions {
  shouldHaveLabel: boolean | null;
  label?: LabelResponse;
  prHasLabel?: boolean;
}

const filterLabelNotNull = (
  labelToSync: LabelToSync,
): labelToSync is SetRequired<LabelToSync, 'label'> => !!labelToSync.label;

export async function syncLabels<EventName extends EmitterWebhookEventName>(
  pullRequest: PullRequestWithDecentData,
  context: ProbotEvent<EventName>,
  labelsToSync: LabelToSync[],
): Promise<LabelResponse[]> {
  const labelsToRemove: LabelResponse[] = [];
  const labelsToAdd: string[] = [];
  const callbacks: SyncLabelCallback[] = [];
  labelsToSync
    .filter(filterLabelNotNull)
    .forEach(
      ({
        shouldHaveLabel,
        label,
        prHasLabel = hasLabelInPR(pullRequest.labels, label),
        onRemove,
        onAdd,
      }) => {
        if (prHasLabel && shouldHaveLabel === false) {
          labelsToRemove.push(label);
          if (onRemove) callbacks.push(onRemove);
        }
        if (shouldHaveLabel === true && !prHasLabel) {
          labelsToAdd.push(label.name);
          if (onAdd) callbacks.push(onAdd);
        }
      },
    );

  let updatedLabels: LabelResponse[] = pullRequest.labels as LabelResponse[];

  if (labelsToRemove.length > 0) {
    for (const label of labelsToRemove) {
      updatedLabels = await removeLabel(context, label);
    }
  }
  if (labelsToAdd.length > 0) {
    const response = await context.octokit.issues.addLabels(
      context.issue({ labels: labelsToAdd }),
    );
    updatedLabels = response.data;
  }

  await Promise.all(callbacks.map((callback) => callback(updatedLabels)));

  return updatedLabels;
}
