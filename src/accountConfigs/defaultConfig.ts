import type { Config } from './types';

const config: Config<never, never> = {
  autoAssignToCreator: true,
  trimTitle: true,
  requiresReviewRequest: false,
  prDefaultOptions: {
    autoMerge: false,
    autoMergeWithSkipCi: false,
    deleteAfterMerge: true,
  },
  parsePR: {
    title: [],
  },
  groups: {},
  waitForGroups: {},
  teams: {},
  labels: {
    list: {
      // /* ci */
      // 'ci/in-progress': { name: ':green_heart: ci/in-progress', color: '#0052cc' },
      // 'ci/fail': { name: ':green_heart: ci/fail', color: '#e11d21' },
      // 'ci/passed': { name: ':green_heart: ci/passed', color: '#86f9b4' },

      /* infos */
      'breaking-changes': {
        name: ':warning: Breaking Changes',
        color: '#ef7934',
      },
    },

    review: {
      checks: {
        inProgress: 'checks/in-progress',
        succeeded: 'checks/success',
        failed: 'checks/fail',
      },
    },
  },
};

export default config;
