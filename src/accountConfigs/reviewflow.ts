import { Config } from './types';
import chrisconfig from './christophehurpeau';

const config: Config<'dev', never> = {
  ...chrisconfig,
  requiresReviewRequest: true,
  groups: {
    dev: {
      christophehurpeau: 'christophe@hurpeau.com',
      'chris-reviewflow': 'christophe.hurpeau+reviewflow@gmail.com',
    },
  },
};
export default config;
