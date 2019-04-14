import { Context } from 'probot';
import { LabelResponse, Labels } from './initRepoLabels';
import { TeamContext } from './teamContext';
interface RepoContextWithoutTeamContext<GroupNames extends string> {
    labels: Labels;
    protectedLabelIds: LabelResponse['id'][];
    hasNeedsReview: (labels: LabelResponse[]) => boolean;
    hasRequestedReview: (labels: LabelResponse[]) => boolean;
    hasChangesRequestedReview: (labels: LabelResponse[]) => boolean;
    hasApprovesReview: (labels: LabelResponse[]) => boolean;
    getNeedsReviewGroupNames: (labels: LabelResponse[]) => GroupNames[];
    lockPROrPRS(prIdOrIds: string | string[], callback: () => Promise<void> | void): Promise<void>;
    getMergeLocked(): number | undefined;
    addMergeLock(prNumber: number): void;
    removeMergeLocked(context: Context<any>, prNumber: number): void;
    reschedule(context: Context<any>, prId: string, prNumber: number): void;
    pushAutomergeQueue(prId: string, prNumber: number): void;
}
export declare type RepoContext<GroupNames extends string = any> = TeamContext<GroupNames> & RepoContextWithoutTeamContext<GroupNames>;
export declare const obtainRepoContext: (context: Context<any>) => RepoContext<any> | Promise<RepoContext<any>> | null;
export {};
//# sourceMappingURL=repoContext.d.ts.map