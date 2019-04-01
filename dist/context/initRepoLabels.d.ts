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
export declare type Labels = Record<string, LabelResponse>;
export declare const initRepoLabels: (context: Context<any>, config: import("../teamconfigs/types").Config<any>) => Promise<Record<string, LabelResponse>>;
//# sourceMappingURL=initRepoLabels.d.ts.map