import christophehurpeau from './christophehurpeau';
import liwijs from './liwijs';
import ornikar from './ornikar';
import reviewflow from './reviewflow';
import type { Config as ConfigType } from './types';

export type Config<
  GroupNames extends string = any,
  TeamNames extends string = any,
> = ConfigType<GroupNames, TeamNames>;

export const accountConfigs: Record<string, Config> = {
  liwijs,
  ornikar,
  christophehurpeau,
  reviewflow,
};

export { default as defaultConfig } from './defaultConfig';

// flat requires node 11
// export const getMembers = <GroupNames extends string = any>(
//   groups: Record<GroupNames, Group>,
// ): string[] => {
//   return Object.values(groups).flat(1);
// };
