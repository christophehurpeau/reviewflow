import chrisconfig from './christophehurpeau';
import type { Config } from './types';

const config: Config<'dev', never> = {
  ...chrisconfig,
};
export default config;
