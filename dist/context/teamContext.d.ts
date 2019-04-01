import { Context } from 'probot';
import { Config } from '../teamconfigs';
import { TeamSlack } from './initTeamSlack';
export interface TeamContext<GroupNames extends string = any> {
    config: Config<GroupNames>;
    slack: TeamSlack;
    getReviewerGroup: (githubLogin: string) => string | undefined;
    getReviewerGroups: (githubLogins: string[]) => string[];
    reviewShouldWait: (reviewerGroup: GroupNames | undefined, requestedReviewers: any[], { includesReviewerGroup, includesWaitForGroups, }: {
        includesReviewerGroup?: boolean;
        includesWaitForGroups?: boolean;
    }) => boolean;
}
export declare const obtainTeamContext: (context: Context<any>, config: import("../teamconfigs/types").Config<any>) => Promise<TeamContext<any>>;
//# sourceMappingURL=teamContext.d.ts.map