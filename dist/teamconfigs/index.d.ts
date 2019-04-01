import { Config as ConfigType, Group } from './types';
export declare type Config<GroupNames extends string = any> = ConfigType<GroupNames>;
export declare const teamConfigs: {
    [owner: string]: Config;
};
export declare const getMembers: <GroupNames extends string = any>(groups: Record<GroupNames, Group>) => string[];
//# sourceMappingURL=index.d.ts.map