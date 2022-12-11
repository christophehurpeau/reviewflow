import chrisconfig from './christophehurpeau';
// import ornikarconfig from './ornikar';
import type { Config } from './types';

const config: Config<'dev', never> = {
  ...chrisconfig,
  experimentalFeatures: {
    ...chrisconfig.experimentalFeatures,
    stepsInComment: true,
  },
  requiresReviewRequest: true,
  warnOnForcePushAfterReviewStarted: {
    message: 'Force-pushing after the review started is a bad practice',
  },
  groups: {
    dev: {
      christophehurpeau: 'christophe@hurpeau.com',
      'chris-reviewflow': 'christophe.hurpeau+reviewflow@gmail.com',
    },
  },
  // parsePR: ornikarconfig.parsePR,
};
export default config;
