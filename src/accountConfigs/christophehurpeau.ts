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
      // /* ci */
      // 'ci/in-progress': { name: ':green_heart: ci/in-progress', color: '#0052cc' },
      // 'ci/fail': { name: ':green_heart: ci/fail', color: '#e11d21' },
      // 'ci/passed': { name: ':green_heart: ci/passed', color: '#86f9b4' },

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
      ci: {
        inProgress: 'ci/in-progress',
        succeeded: 'ci/success',
        failed: 'ci/fail',
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
