import { Context } from 'probot';
import { LabelResponse, Labels } from './initRepoLabels';
import { TeamContext } from './teamContext';
export interface LockedMergePr {
    id: number;
    number: number;
    branch: string;
}
interface RepoContextWithoutTeamContext<GroupNames extends string> {
    labels: Labels;
    protectedLabelIds: LabelResponse['id'][];
    hasNeedsReview: (labels: LabelResponse[]) => boolean;
    hasRequestedReview: (labels: LabelResponse[]) => boolean;
    hasChangesRequestedReview: (labels: LabelResponse[]) => boolean;
    hasApprovesReview: (labels: LabelResponse[]) => boolean;
    getNeedsReviewGroupNames: (labels: LabelResponse[]) => GroupNames[];
    lockPROrPRS(prIdOrIds: string | string[], callback: () => Promise<void> | void): Promise<void>;
    getMergeLockedPr(): LockedMergePr;
    addMergeLockPr(pr: LockedMergePr): void;
    removeMergeLockedPr(context: Context<any>, pr: LockedMergePr): void;
    reschedule(context: Context<any>, pr: LockedMergePr): void;
    pushAutomergeQueue(pr: LockedMergePr): void;
}
export declare type RepoContext<GroupNames extends string = any> = TeamContext<GroupNames> & RepoContextWithoutTeamContext<GroupNames>;
export declare const obtainRepoContext: (context: Context<any>) => RepoContext<any> | Promise<RepoContext<any>> | null;
export {};
//# sourceMappingURL=repoContext.d.ts.map