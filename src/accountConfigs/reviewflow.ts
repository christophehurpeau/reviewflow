import chrisconfig from './christophehurpeau';
// import ornikarconfig from './ornikar';
import type { Config } from './types';

const config: Config<never> = {
  ...chrisconfig,
  experimentalFeatures: {
    ...chrisconfig.experimentalFeatures,
  },
  requiresReviewRequest: true,
  warnOnForcePushAfterReviewStarted: {
    message: 'Force-pushing after the review started is a bad practice',
  },
  // parsePR: ornikarconfig.parsePR,
};
export default config;
