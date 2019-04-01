import { Context } from 'probot';
export interface TeamSlack {
    mention: (githubLogin: string) => string;
    postMessage: (githubLogin: string, text: string) => Promise<void>;
}
export declare const initTeamSlack: <GroupNames extends string>(context: Context<any>, config: import("../teamconfigs/types").Config<GroupNames>) => Promise<TeamSlack>;
//# sourceMappingURL=initTeamSlack.d.ts.map