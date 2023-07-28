import type { EmitterWebhookEventName } from '@octokit/webhooks';
import type { SetRequired } from 'type-fest';
import type { LabelResponse } from '../../../../context/initRepoLabels';
import type { ProbotEvent } from '../../../probot-types';
import type { PullRequestWithDecentData } from '../../utils/PullRequestData';
import hasLabelInPR from './labels/hasLabelInPR';

type SyncLabelCallback = (
  prLabels: LabelResponse[],
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
) => Promise<boolean | undefined | void> | boolean | undefined | void;

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
      context.repo({
        issue_number: pullRequest.number,
        name: label.name,
      }),
    );
    if (onRemove) {
      if ((await onRemove(response.data)) === false) {
        await context.octokit.issues.addLabels(
          context.repo({
            issue_number: pullRequest.number,
            labels: [label.name],
          }),
        );
      }
    }
  }
  if (shouldHaveLabel && !prHasLabel) {
    const response = await context.octokit.issues.addLabels(
      context.repo({
        issue_number: pullRequest.number,
        labels: [label.name],
      }),
    );
    if (onAdd) {
      if ((await onAdd(response.data)) === false) {
        await context.octokit.issues.removeLabel(
          context.repo({
            issue_number: pullRequest.number,
            name: label.name,
          }),
        );
      }
    }
  }
}

export const removeLabel = async <EventName extends EmitterWebhookEventName>(
  context: ProbotEvent<EventName>,
  pullRequest: PullRequestWithDecentData,
  label: LabelResponse,
): Promise<LabelResponse[]> => {
  const response = await context.octokit.issues.removeLabel(
    context.repo({
      issue_number: pullRequest.number,
      name: label.name,
    }),
  );
  return response.data;
};

export interface LabelToSync extends SyncLabelOptions {
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
        if (!label) return;
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
      try {
        updatedLabels = await removeLabel(context, pullRequest, label);
      } catch (error) {
        // can happen on old prs without all labels reviewflow expects
        if ((error as any).status === 404) {
          // do nothing, continue
        } else {
          throw error;
        }
      }
    }
  }
  if (labelsToAdd.length > 0) {
    const response = await context.octokit.issues.addLabels(
      context.repo({
        issue_number: pullRequest.number,
        labels: labelsToAdd,
      }),
    );
    updatedLabels = response.data;
  }

  await Promise.all(callbacks.map((callback) => callback(updatedLabels)));

  return updatedLabels;
}
