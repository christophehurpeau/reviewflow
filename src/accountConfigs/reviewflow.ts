import chrisconfig from './christophehurpeau';
// import ornikarconfig from './ornikar';
import type { Config } from './types';

const config: Config<'dev', never> = {
  ...chrisconfig,
  requiresReviewRequest: true,
  groups: {
    dev: {
      christophehurpeau: 'christophe@hurpeau.com',
      'chris-reviewflow': 'christophe.hurpeau+reviewflow@gmail.com',
    },
  },
  // parsePR: ornikarconfig.parsePR,
};
export default config;
