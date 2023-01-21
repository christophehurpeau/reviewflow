import type { Config } from './types';

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
        color: '#B2E1FF',
      },
      'checks/failed': { name: ':green_heart: checks/fail', color: '#e11d21' },
      'checks/passed': {
        name: ':green_heart: checks/passed',
        color: '#64DD17',
      },

      /* code */
      'code/needs-review': {
        name: ':ok_hand: code/needs-review',
        color: '#FFD57F',
      },
      'code/review-requested': {
        name: ':ok_hand: code/review-requested',
        color: '#B2E1FF',
      },
      'code/changes-requested': {
        name: ':ok_hand: code/changes-requested',
        color: '#e11d21',
      },
      'code/approved': {
        name: ':ok_hand: code/approved',
        color: '#64DD17',
      },

      /* auto merge */
      'merge/automerge': {
        name: ':vertical_traffic_light: automerge',
        color: '#64DD17',
      },
      'merge/skip-ci': {
        name: ':vertical_traffic_light: skip-ci',
        color: '#e1e8ed',
      },
      'merge/update-branch': {
        name: ':arrows_counterclockwise: update branch',
        color: '#64DD17',
      },

      /* feature-branch */
      'feature-branch': {
        name: 'feature-branch',
        color: '#7FCEFF',
      },

      /* infos */
      'breaking-changes': {
        name: ':warning: Breaking Changes',
        color: '#ef7934',
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
