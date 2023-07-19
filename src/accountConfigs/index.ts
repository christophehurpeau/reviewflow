import christophehurpeau from './christophehurpeau';
import liwijs from './liwijs';
import ornikar from './ornikar';
import reviewflow from './reviewflow';
import type { Config as ConfigType } from './types';

export type Config<TeamNames extends string = any> = ConfigType<TeamNames>;

export const accountConfigs: Record<string, Config> = {
  liwijs,
  ornikar,
  christophehurpeau,
  reviewflow,
};

export { default as defaultConfig } from './defaultConfig';
