import type { EmitterWebhookEventName } from "@octokit/webhooks";
import type { SetRequired } from "type-fest";
import type { AppContext } from "../../../../context/AppContext.ts";
import type { LabelResponse } from "../../../../context/initRepoLabels";
import type { ReviewflowPr } from "../../../../mongo.ts";
import type { ProbotEvent } from "../../../probot-types";
import type { PullRequestWithDecentData } from "../../utils/PullRequestData";
import hasLabelInPR from "./labels/hasLabelInPR.ts";
import { updateReviewflowPrLabels } from "./labels/reviewflowPrLabels.ts";

type SyncLabelCallback = (
  prLabels: LabelResponse[],
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
) => Promise<boolean | undefined | void> | boolean | undefined | void;

/**
 * Labels changed by reviewflow itself are notified with a bot sender, and those events
 * are ignored: the pull request document is updated here instead.
 */
export interface PersistLabelsTo {
  appContext: AppContext;
  reviewflowPr: ReviewflowPr;
}

interface SyncLabelOptions {
  onRemove?: SyncLabelCallback;
  onAdd?: SyncLabelCallback;
}

interface SyncSingleLabelOptions extends SyncLabelOptions {
  persist?: PersistLabelsTo;
}

/** @deprecated use syncLabels instead */
export default async function syncLabel<
  EventName extends EmitterWebhookEventName,
>(
  pullRequest: PullRequestWithDecentData,
  context: ProbotEvent<EventName>,
  shouldHaveLabel: boolean,
  label: LabelResponse | undefined,
  prHasLabel = hasLabelInPR(pullRequest.labels, label),
  { onRemove, onAdd, persist }: SyncSingleLabelOptions = {},
): Promise<void> {
  if (!label) return;
  if (prHasLabel && !shouldHaveLabel) {
    const response = await context.octokit.rest.issues.removeLabel(
      context.repo({
        issue_number: pullRequest.number,
        name: label.name,
      }),
    );
    let updatedLabels = response.data;
    if (onRemove) {
      if ((await onRemove(response.data)) === false) {
        const addResponse = await context.octokit.rest.issues.addLabels(
          context.repo({
            issue_number: pullRequest.number,
            labels: [label.name],
          }),
        );
        updatedLabels = addResponse.data;
      }
    }
    if (persist) {
      await updateReviewflowPrLabels({ ...persist, labels: updatedLabels });
    }
  }
  if (shouldHaveLabel && !prHasLabel) {
    const response = await context.octokit.rest.issues.addLabels(
      context.repo({
        issue_number: pullRequest.number,
        labels: [label.name],
      }),
    );
    let updatedLabels = response.data;
    if (onAdd) {
      if ((await onAdd(response.data)) === false) {
        const removeResponse = await context.octokit.rest.issues.removeLabel(
          context.repo({
            issue_number: pullRequest.number,
            name: label.name,
          }),
        );
        updatedLabels = removeResponse.data;
      }
    }
    if (persist) {
      await updateReviewflowPrLabels({ ...persist, labels: updatedLabels });
    }
  }
}

export const removeLabel = async <EventName extends EmitterWebhookEventName>(
  context: ProbotEvent<EventName>,
  pullRequest: PullRequestWithDecentData,
  label: LabelResponse,
  persist?: PersistLabelsTo,
): Promise<LabelResponse[]> => {
  const response = await context.octokit.rest.issues.removeLabel(
    context.repo({
      issue_number: pullRequest.number,
      name: label.name,
    }),
  );
  if (persist) {
    await updateReviewflowPrLabels({ ...persist, labels: response.data });
  }
  return response.data;
};

export interface LabelToSync extends SyncLabelOptions {
  shouldHaveLabel: boolean | null;
  label?: LabelResponse;
  prHasLabel?: boolean;
}

const filterLabelNotNull = (
  labelToSync: LabelToSync,
): labelToSync is SetRequired<LabelToSync, "label"> => !!labelToSync.label;

export async function syncLabels<EventName extends EmitterWebhookEventName>(
  pullRequest: PullRequestWithDecentData,
  context: ProbotEvent<EventName>,
  labelsToSync: LabelToSync[],
  persist?: PersistLabelsTo,
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

  let updatedLabels: LabelResponse[] = pullRequest.labels;

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
    const response = await context.octokit.rest.issues.addLabels(
      context.repo({
        issue_number: pullRequest.number,
        labels: labelsToAdd,
      }),
    );
    updatedLabels = response.data;
  }

  /*
   * Only persisted when github answered with the labels of the pull request: `pullRequest`
   * can be a payload snapshot taken before another action of the same handler changed them.
   * Persisted before the callbacks, which can change labels again through their own persist.
   */
  if (persist && updatedLabels !== pullRequest.labels) {
    await updateReviewflowPrLabels({ ...persist, labels: updatedLabels });
  }

  // eslint-disable-next-line @typescript-eslint/await-thenable
  await Promise.all(callbacks.map((callback) => callback(updatedLabels)));

  return updatedLabels;
}
