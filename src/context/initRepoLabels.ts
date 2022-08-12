import type { RestEndpointMethodTypes } from '@octokit/rest';
import type { EmitterWebhookEventName } from '@octokit/webhooks';
import type { Config } from '../accountConfigs';
import type { ProbotEvent } from '../events/probot-types';

export interface LabelResponse {
  id: number;
  node_id: string;
  url: string;
  name: string;
  description?: string | null;
  color: string;
  default: boolean;
}

export type LabelsRecord = Record<string, LabelResponse>;

export const getLabelsForRepo = async <T extends EmitterWebhookEventName>(
  context: ProbotEvent<T>,
): Promise<
  RestEndpointMethodTypes['issues']['listLabelsForRepo']['response']['data']
> => {
  const { data: labels } = await context.octokit.issues.listLabelsForRepo(
    context.repo({ per_page: 100 }),
  );
  return labels;
};

export const initRepoLabels = async <
  T extends EmitterWebhookEventName,
  GroupNames extends string,
>(
  context: ProbotEvent<T>,
  config: Config<GroupNames>,
): Promise<LabelsRecord> => {
  const labels = await getLabelsForRepo<T>(context);
  const finalLabels: Record<string, LabelResponse> = {};

  for (const [labelKey, labelConfig] of Object.entries(config.labels.list)) {
    const labelColor = labelConfig.color.slice(1);
    const description = labelConfig.description
      ? `${labelConfig.description} - Synced by reviewflow`
      : `Synced by reviewflow for ${labelKey}`;

    let existingLabel = labels.find((label) => label.name === labelConfig.name);
    if (!existingLabel) {
      existingLabel = labels.find((label) => label.description === description);
    }
    if (!existingLabel) {
      if (labelKey === 'design/needs-review') {
        existingLabel = labels.find(
          (label) => label.name === 'needs-design-review',
        );
      }
      if (labelKey === 'design/approved') {
        existingLabel = labels.find(
          (label) => label.name === 'design-reviewed',
        );
      }
      if (labelKey === 'teams/ops') {
        existingLabel = labels.find((label) => label.name === 'archi');
      }
      if (labelKey === 'merge/skip-ci') {
        existingLabel = labels.find(
          (label) => label.name === 'automerge/skip-ci',
        );
      }
    }

    if (!existingLabel) {
      const result = await context.octokit.issues.createLabel(
        context.repo({
          name: labelConfig.name,
          color: labelColor,
          description,
        }),
      );
      finalLabels[labelKey] = result.data;
    } else if (
      existingLabel.name !== labelConfig.name ||
      existingLabel.color !== labelColor ||
      existingLabel.description !== description
    ) {
      context.log.info(
        {
          current_name: existingLabel.name,
          name: existingLabel.name !== labelConfig.name && labelConfig.name,
          color: existingLabel.color !== labelColor && labelColor,
          description: existingLabel.description !== description && description,
        },
        'Needs to update label',
      );

      const result = await context.octokit.issues.updateLabel(
        context.repo({
          name: existingLabel.name,
          new_name: labelConfig.name,
          color: labelColor,
          description,
        }),
      );
      finalLabels[labelKey] = result.data;
    } else {
      finalLabels[labelKey] = existingLabel;
    }
  }

  return finalLabels;
};
