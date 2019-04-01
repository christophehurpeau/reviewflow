import { Config } from './types';

const config: Config<'dev' | 'design'> = {
  slackToken: process.env.ORNIKAR_SLACK_TOKEN,
  autoAssignToCreator: true,
  trimTitle: true,
  requiresReviewRequest: true,
  prLint: {
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
        regExp: /\s(ONK-(\d+)|\[no issue])$/,
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
      abarreir: `alexandre${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      christophehurpeau: `christophe${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      arthurflachs: `arthur${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      skyline42sh: `alexandre.charbonnier${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      LentnerStefan: `stefan${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      HugoGarrido: `hugo${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      CorentinAndre: `corentin${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      rigma: `romain${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      Mxime: `maxime${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      damienorny: `damien.orny${process.env.ORNIKAR_EMAIL_DOMAIN}`,
    },
    design: {
      jperriere: `julien${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      CoralineColasse: `coraline${process.env.ORNIKAR_EMAIL_DOMAIN}`,
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

      /* design */
      'design/needs-review': {
        name: ':art: design/needs-review',
        color: '#FFD57F',
      },
      'design/review-requested': {
        name: ':art: design/review-requested',
        color: '#B2E1FF',
      },
      'design/changes-requested': {
        name: ':art: design/changes-requested',
        color: '#e11d21',
      },
      'design/approved': {
        name: ':art: design/approved',
        color: '#64DD17',
      },

      /* auto merge */
      'merge/automerge': {
        name: ':soon: automerge',
        color: '#64DD17',
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
