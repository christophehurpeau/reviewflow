import Webhooks from '@octokit/webhooks';
import { Context } from 'probot';
import { GroupLabels } from '../teamconfigs/types';
import { LabelResponse, Labels } from './initRepoLabels';
import { TeamContext } from './teamContext';
interface RepoContextWithoutTeamContext<GroupNames extends string = any> {
    labels: Labels;
    updateStatusCheckFromLabels<E>(context: Context<E>, labels?: LabelResponse[]): Promise<void>;
    lockPR<E extends Webhooks.WebhookPayloadPullRequest>(context: Context<E>, callback: () => Promise<void> | void): Promise<void>;
    updateReviewStatus<E extends Webhooks.WebhookPayloadPullRequest>(context: Context<E>, reviewGroup: GroupNames | undefined, { add: labelsToAdd, remove: labelsToRemove, }: {
        add?: (GroupLabels | false | undefined)[];
        remove?: (GroupLabels | false | undefined)[];
    }): Promise<void>;
    addStatusCheckToLatestCommit<E>(context: Context<E>): Promise<void>;
}
export declare type RepoContext<GroupNames extends string = any> = TeamContext<GroupNames> & RepoContextWithoutTeamContext<GroupNames>;
export declare const obtainRepoContext: (context: Context<any>) => RepoContext<any> | Promise<RepoContext<any>> | null;
export {};
//# sourceMappingURL=repoContext.d.ts.map