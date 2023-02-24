import { githubPalette } from './color-palettes/githubPalette';
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
    legacyToRemove: {
      'checks/in-progress': {
        name: ':green_heart: checks/in-progress',
        color: githubPalette.scaleGray6,
      },
    },
    list: {
      /* checks */
      'checks/failed': {
        name: ':green_heart: checks/fail',
        color: githubPalette.dangerEmphasis,
      },
      'checks/passed': {
        name: ':green_heart: checks/passed',
        color: githubPalette.successEmphasis,
      },

      /* infos */
      'breaking-changes': {
        name: ':warning: Breaking Changes',
        color: githubPalette.attentionEmphasis,
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
