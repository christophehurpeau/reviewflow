import { Config as ConfigType, Group } from './types';
import ornikar from './ornikar';
import christophehurpeau from './christophehurpeau';

export type Config<GroupNames extends string = any> = ConfigType<GroupNames>;

export const teamConfigs: { [owner: string]: Config } = {
  ornikar,
  christophehurpeau,
};

export const getMembers = <GroupNames extends string = any>(
  groups: Record<GroupNames, Group>,
): string[] => {
  return Object.values(groups).flat(1);
};
