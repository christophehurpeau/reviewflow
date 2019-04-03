import { Context } from 'probot';
export interface LabelResponse {
    id: number;
    node_id: string;
    url: string;
    name: string;
    description: string;
    color: string;
    default: boolean;
}
export interface Labels {
    [key: string]: LabelResponse;
}
export declare const initRepoLabels: <GroupNames extends string>(context: Context<any>, config: import("../teamconfigs/types").Config<GroupNames>) => Promise<Labels>;
//# sourceMappingURL=initRepoLabels.d.ts.map