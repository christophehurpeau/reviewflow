import Webhooks from '@octokit/webhooks';
import { Context } from 'probot';
import { LabelResponse } from '../../context/initRepoLabels';
import { RepoContext } from '../../context/repoContext';
export declare const updateReviewStatus: <E extends Webhooks.WebhookPayloadPullRequest, GroupNames extends string = any>(context: Context<E>, repoContext: RepoContext<any>, reviewGroup: GroupNames, { add: labelsToAdd, remove: labelsToRemove, }: {
    add?: (false | "needsReview" | "requested" | "changesRequested" | "approved" | undefined)[] | undefined;
    remove?: (false | "needsReview" | "requested" | "changesRequested" | "approved" | undefined)[] | undefined;
}) => Promise<LabelResponse[]>;
//# sourceMappingURL=updateReviewStatus.d.ts.map