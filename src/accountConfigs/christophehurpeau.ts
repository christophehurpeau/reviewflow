import { githubPalette } from './color-palettes/githubPalette';
import type { Config } from './types';

const config: Config<never> = {
  autoAssignToCreator: true,
  trimTitle: true,
  requiresReviewRequest: false,
  prDefaultOptions: {
    autoMerge: false,
    autoMergeWithSkipCi: false,
    deleteAfterMerge: true,
  },
  experimentalFeatures: {
    lintPullRequestTitleWithConventionalCommit: true,
    conventionalCommitBangBreakingChange: true,
  },
  teams: {},
  labels: {
    legacyToRemove: {
      'checks/in-progress': {
        name: ':green_heart: checks/in-progress',
        color: githubPalette.scaleGray6,
      },
    },
    list: {
      /* auto approve */
      'review/auto-approve': {
        name: ':white_check_mark: bot approval',
        color: githubPalette.successEmphasis,
      },

      /* checks */
      'checks/failed': {
        name: ':green_heart: checks/fail',
        color: githubPalette.dangerEmphasis,
      },
      'checks/passed': {
        name: ':green_heart: checks/passed',
        color: githubPalette.successEmphasis,
      },

      /* code */
      'code/needs-review': {
        name: ':ok_hand: code/needs-review',
        color: githubPalette.attentionEmphasis,
      },
      'code/review-requested': {
        name: ':ok_hand: code/review-requested',
        color: githubPalette.scaleGray6,
      },
      'code/changes-requested': {
        name: ':ok_hand: code/changes-requested',
        color: githubPalette.dangerEmphasis,
      },
      'code/approved': {
        name: ':ok_hand: code/approved',
        color: githubPalette.successEmphasis,
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

      /* feature-branch */
      'feature-branch': {
        name: 'feature-branch',
        color: githubPalette.accentEmphasis,
      },

      /* infos */
      'breaking-changes': {
        name: ':warning: Breaking Changes',
        color: githubPalette.attentionEmphasis,
      },
    },

    review: {
      needsReview: 'code/needs-review',
      requested: 'code/review-requested',
      changesRequested: 'code/changes-requested',
      approved: 'code/approved',
    },
  },
};

export default config;
