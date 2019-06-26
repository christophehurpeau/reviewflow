import { Config } from './types';

const config: Config<'dev', never> = {
  autoAssignToCreator: true,
  trimTitle: true,
  requiresReviewRequest: false,
  prDefaultOptions: {
    featureBranch: false,
    autoMergeWithSkipCi: false,
    autoMerge: false,
    deleteAfterMerge: true,
  },
  parsePR: {
    title: [
      {
        regExp:
          // eslint-disable-next-line unicorn/no-unsafe-regex
          /^(revert: )?(build|chore|ci|docs|feat|fix|perf|refactor|style|test)(\(([a-z\-/]*)\))?:\s/,
        error: {
          title: 'Title does not match commitlint conventional',
          summary:
            'https://github.com/marionebl/commitlint/tree/master/%40commitlint/config-conventional',
        },
      },
    ],
  },
  groups: {
    dev: {
      christophehurpeau: 'christophe@hurpeau.com',
      'chris-reviewflow': 'christophe.hurpeau+reviewflow@gmail.com',
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
        name: ':soon: automerge',
        color: '#64DD17',
      },

      /* feature-branch */
      'feature-branch': {
        name: 'feature-branch',
        color: '#7FCEFF',
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
