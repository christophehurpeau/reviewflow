import { Context } from 'probot';
import { LabelResponse, Labels } from './initRepoLabels';
import { TeamContext } from './teamContext';
interface RepoContextWithoutTeamContext {
    labels: Labels;
    hasNeedsReview: (labels: LabelResponse[]) => boolean;
    hasRequestedReview: (labels: LabelResponse[]) => boolean;
    hasApprovesReview: (labels: LabelResponse[]) => boolean;
    lockPROrPRS(prIdOrIds: string | string[], callback: () => Promise<void> | void): Promise<void>;
}
export declare type RepoContext<GroupNames extends string = any> = TeamContext<GroupNames> & RepoContextWithoutTeamContext;
export declare const obtainRepoContext: (context: Context<any>) => RepoContext<any> | Promise<RepoContext<any>> | null;
export {};
//# sourceMappingURL=repoContext.d.ts.map