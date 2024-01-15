import { githubPalette } from './color-palettes/githubPalette';
import type { Config } from './types';

const config: Config<never> = {
  autoAssignToCreator: true,
  trimTitle: true,
  lintPullRequestTitleWithConventionalCommit: false,
  requiresReviewRequest: true,
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

      /* auto merge */
      'merge/automerge': {
        name: ':vertical_traffic_light: automerge',
        color: githubPalette.successEmphasis,
      },
      'merge/skip-ci': {
        name: ':vertical_traffic_light: skip-ci',
        color: githubPalette.scaleBlue1,
      },
      'merge/update-branch': {
        name: ':arrows_counterclockwise: update branch',
        color: githubPalette.accentEmphasis,
      },
    },
  },
};

export default config;