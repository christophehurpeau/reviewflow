import christophehurpeau from './christophehurpeau';
import defaultConfig from './defaultConfig';
import ornikar from './ornikar';
import reviewflow from './reviewflow';
import type { Config as ConfigType } from './types';

export type Config<
  GroupNames extends string = any,
  TeamNames extends string = any
> = ConfigType<GroupNames, TeamNames>;

export const accountConfigs: Record<string, Config> = {
  ornikar,
  christophehurpeau,
  reviewflow,
};

export { defaultConfig };

// flat requires node 11
// export const getMembers = <GroupNames extends string = any>(
//   groups: Record<GroupNames, Group>,
// ): string[] => {
//   return Object.values(groups).flat(1);
// };
