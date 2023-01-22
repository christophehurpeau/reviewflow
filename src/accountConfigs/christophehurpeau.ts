import type { Config } from './types';

const githubPalette = {
  accentEmphasis: '#1f6feb',
  successEmphasis: '#238636',
  attentionEmphasis: '#9e6a03',
  severeEmphasis: '#bd561d',
  dangerEmphasis: '#da3633',
  doneEmphasis: '#8957e5',
  scaleBlue1: '#a5d6ff',
  scaleGray6: '#57606a',
};

const config: Config<'dev', never> = {
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
    githubAutoMerge: true,
  },
  groups: {
    dev: {
      christophehurpeau: 'christophe@hurpeau.com',
      tilap: 'jlavinh@gmail.com',
    },
  },
  waitForGroups: {
    dev: [],
  },
  teams: {},
  labels: {
    list: {
      /* checks */
      'checks/in-progress': {
        name: ':green_heart: checks/in-progress',
        color: githubPalette.scaleGray6,
      },
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
      checks: {
        inProgress: 'checks/in-progress',
        succeeded: 'checks/passed',
        failed: 'checks/failed',
      },
      dev: {
        needsReview: 'code/needs-review',
        requested: 'code/review-requested',
        changesRequested: 'code/changes-requested',
        approved: 'code/approved',
      },
    },
  },
};

export default config;
