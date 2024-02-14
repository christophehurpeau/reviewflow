import { githubPalette } from './color-palettes/githubPalette';
import type { Config } from './types';

const config: Config<never> = {
  autoAssignToCreator: true,
  cleanTitle: true,
  lintPullRequestTitleWithConventionalCommit: false,
  requiresReviewRequest: false,
  prDefaultOptions: {
    autoMerge: false,
    autoMergeWithSkipCi: false,
    deleteAfterMerge: true,
  },
  parsePR: {
    title: [],
  },
  teams: {},
  labels: {
    legacyToRemove: {
      'checks/in-progress': {
        name: ':green_heart: checks/in-progress',
        color: githubPalette.scaleGray6,
      },
      'checks/passed': {
        name: ':green_heart: checks/passed',
        color: githubPalette.successEmphasis,
      },
    },
    list: {
      /* checks */
      'checks/failed': {
        name: ':green_heart: checks/fail',
        color: githubPalette.dangerEmphasis,
      },

      /* infos */
      'breaking-changes': {
        name: ':warning: Breaking Changes',
        color: githubPalette.attentionEmphasis,
      },
    },
  },
};

export default config;
