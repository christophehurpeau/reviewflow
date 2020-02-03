/* eslint-disable max-lines */

import { Config } from './types';

const config: Config<'dev' | 'design', 'ops' | 'frontends' | 'backends'> = {
  slackToken: process.env.ORNIKAR_SLACK_TOKEN,
  autoAssignToCreator: true,
  trimTitle: true,
  ignoreRepoPattern: 'infra-*',
  requiresReviewRequest: true,
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
      {
        bot: false,
        regExp: /\s([A-Z]{2,}-(\d+)|\[no issue])$/,
        error: {
          title: 'Title does not have JIRA issue',
          summary: 'The PR title should end with ONK-0000, or [no issue]',
        },
        status: 'jira-issue',
        statusInfoFromMatch: (match) => {
          const issue = match[1];
          if (issue === '[no issue]') {
            return {
              title: 'No issue',
              summary: '',
            };
          }
          return {
            inBody: true,
            url: `https://ornikar.atlassian.net/browse/${issue}`,
            title: `JIRA issue: ${issue}`,
            summary: `[${issue}](https://ornikar.atlassian.net/browse/${issue})`,
          };
        },
      },
    ],
  },

  groups: {
    dev: {
      /* ops */
      JulienBreux: `julien.breux${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      'Alan-pad': null,
      CamilSadiki: null,

      /* back */
      abarreir: `alexandre${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      arthurflachs: `arthur${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      damienorny: `damien.orny${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      'Thierry-girod': `thierry${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      darame07: `kevin${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      Pixy: `pierre-alexis${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      Radyum: `romain.reynaud${process.env.ORNIKAR_EMAIL_DOMAIN}`,

      /* front */
      christophehurpeau: `christophe${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      HugoGarrido: `hugo${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      LentnerStefan: `stefan${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      CorentinAndre: `corentin${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      Mxime: `maxime${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      vlbr: `valerian${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      'budet-b': `benjamin.budet${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      mdcarter: `maxime.dehaye${process.env.ORNIKAR_EMAIL_DOMAIN}`,
    },
    design: {
      jperriere: `julien${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      CoralineColasse: `coraline${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      Lenamari: `lena${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      'AlexisRiols-Ornikar': `alexis.riols${process.env.ORNIKAR_EMAIL_DOMAIN}`,
    },
  },

  teams: {
    ops: {
      logins: ['JulienBreux', 'Alan-pad', 'CamilSadiki'],
      labels: ['teams/ops'],
    },

    backends: {
      logins: [
        'abarreir',
        'arthurflachs',
        'damienorny',
        'Thierry-girod',
        'darame07',
        'Pixy',
        'Radyum',
      ],
      labels: ['teams/backend'],
    },

    frontends: {
      logins: [
        'christophehurpeau',
        'HugoGarrido',
        'LentnerStefan',
        'CorentinAndre',
        'Mxime',
        'vlbr',
        'budet-b',
        'mdcarter',
      ],
      labels: ['teams/frontend'],
    },
  },

  waitForGroups: {
    dev: [],
    design: ['dev'],
  },
  labels: {
    list: {
      // /* ci */
      // 'ci/in-progress': { name: ':green_heart: ci/in-progress', color: '#0052cc' },
      // 'ci/fail': { name: ':green_heart: ci/fail', color: '#e11d21' },
      // 'ci/passed': { name: ':green_heart: ci/passed', color: '#86f9b4' },

      /* code */
      'code/needs-review': {
        name: ':ok_hand: code/needs-review',
        color: '#FFC44C',
      },
      'code/review-requested': {
        name: ':ok_hand: code/review-requested',
        color: '#DAE1E6',
      },
      'code/changes-requested': {
        name: ':ok_hand: code/changes-requested',
        color: '#e11d21',
      },
      'code/approved': {
        name: ':ok_hand: code/approved',
        color: '#64DD17',
      },

      /* design */
      'design/needs-review': {
        name: ':art: design/needs-review',
        color: '#FFC44C',
      },
      'design/review-requested': {
        name: ':art: design/review-requested',
        color: '#DAE1E6',
      },
      'design/changes-requested': {
        name: ':art: design/changes-requested',
        color: '#e11d21',
      },
      'design/approved': {
        name: ':art: design/approved',
        color: '#64DD17',
      },

      /* teams */
      'teams/ops': {
        name: 'ops',
        color: '#003b55',
      },
      'teams/backend': {
        name: 'backend',
        color: '#6ad8cb',
      },
      'teams/frontend': {
        name: 'frontend',
        color: '#8a5abc',
      },

      /* auto merge */
      'merge/automerge': {
        name: ':soon: automerge',
        color: '#64DD17',
      },
      'merge/skip-ci': {
        name: 'automerge/skip-ci',
        color: '#e1e8ed',
      },

      /* feature-branch */
      'feature-branch': {
        name: 'feature-branch',
        color: '#7FCEFF',
      },

      /* infos */
      'breaking-changes': {
        name: ':warning: Breaking Changes',
        description: 'This issue or pull request will need a new major version',
        color: '#FF6F00',
      },
      duplicate: {
        name: 'duplicate',
        description: 'This issue or pull request already exists',
        color: '#ECEFF1',
      },
      documentation: {
        name: 'documentation',
        description: 'Improvements or additions to documentation',
        color: '#7FCEFF',
      },
      rfc: {
        name: 'RFC',
        description: 'Request For Comments',
        color: '#FFD3B2',
      },
      bug: {
        name: 'bug',
        description: "Something isn't working",
        color: '#FF3D00',
      },
      enhancement: {
        name: 'enhancement',
        description: 'New feature or request',
        color: '#7FCEFF',
      },
      'help-wanted': {
        name: 'help wanted',
        description: 'Extra attention is needed',
        color: '#B1EE8B',
      },
      question: {
        name: 'question',
        description: 'Further information is requested',
        color: '#F860A4',
      },
      wontfix: {
        name: 'wontfix',
        description: 'This will not be worked on',
        color: '#ECEFF1',
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
      design: {
        needsReview: 'design/needs-review',
        requested: 'design/review-requested',
        changesRequested: 'design/changes-requested',
        approved: 'design/approved',
      },
    },
  },
};

export default config;
