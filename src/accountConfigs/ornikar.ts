/* eslint-disable max-lines */
import type { Config } from './types';

const config: Config<'dev' | 'design', 'ops' | 'frontends' | 'backends'> = {
  autoAssignToCreator: true,
  trimTitle: true,
  ignoreRepoPattern: '(infra-.*|devenv)',
  requiresReviewRequest: true,
  autoMergeRenovateWithSkipCi: false,
  prDefaultOptions: {
    autoMergeWithSkipCi: false,
    autoMerge: false,
    deleteAfterMerge: true,
  },
  parsePR: {
    title: [
      {
        // eslint-disable-next-line unicorn/no-unsafe-regex
        regExp: /^(?<revert>revert: )?(?<type>build|chore|ci|docs|feat|fix|perf|refactor|style|test)(?<scope>\([/A-Za-z-]+\)?((?=:\s)|(?=!:\s)))?(?<breaking>!)?(?<subject>:\s.*)$/,
        createStatusInfo: (match) => {
          if (match) {
            return null;
          }

          return {
            type: 'failure',
            title: 'Title does not match commitlint conventional',
            summary:
              'https://www.npmjs.com/package/@commitlint/config-conventional',
          };
        },
      },
      {
        regExp: /\s([A-Z][\dA-Z]+-(\d+)|\[no issue])$/,
        status: 'jira-issue',
        createStatusInfo: (match, prInfo, isPrFromBot) => {
          if (match) {
            const issue = match[1];
            if (issue === '[no issue]') {
              return {
                type: 'success',
                title: '✓ No issue',
                summary: '',
              };
            }
            return {
              type: 'success',
              inBody: true,
              title: `✓ JIRA issue: ${issue}`,
              summary: `[${issue}](https://ornikar.atlassian.net/browse/${issue})`,
              url: `https://ornikar.atlassian.net/browse/${issue}`,
            };
          }

          if (isPrFromBot) {
            return {
              type: 'success',
              title: 'Title does not have Jira issue but PR created by bot',
              summary: '',
            };
          }

          return {
            type: 'failure',
            title: 'Title does not have Jira issue',
            summary: 'The PR title should end with ONK-0000, or [no issue]',
          };
        },
      },
    ],
    head: [
      {
        bot: false,
        // eslint-disable-next-line unicorn/no-unsafe-regex
        regExp: /^(?<revert>revert-\d+-)?(?<type>build|chore|ci|docs|feat|fix|perf|refactor|style|test)(?<scope>\/[a-z-]+)?\/(?<breaking>!)?(?<subject>.*)(?:-(?<jiraIssue>[A-Z][\dA-Z]+-(\d+)))?$/,
        status: 'branch-name',
        createStatusInfo: (match, { title }) => {
          const idealBranchName = title
            .replace(/\s*\[no issue]$/, '')
            .replace(/\s*(\(|\):|:)\s*/g, '/')
            .replace(/[\s,_-]+/g, '-');

          if (!match) {
            return {
              type: 'failure',
              title: `Suggested branch name: "${idealBranchName}"`,
              summary: '',
            };
          }

          if (match[0] === idealBranchName) {
            return {
              type: 'success',
              title: '✓ The branch name matches PR title',
              summary: '',
            };
          }

          return {
            type: 'success',
            title: '✓ The branch name is valid',
            summary: '',
          };
        },
      },
    ],
    base: [
      {
        regExp: /^(master|main)$/,
        createStatusInfo: (match) => {
          if (match) {
            return null;
          }

          return {
            type: 'failure',
            title: 'PR to branches other than main is not recommended',
            summary: '',
            url:
              'https://ornikar.atlassian.net/wiki/spaces/TECH/pages/2221900272/Should+I+make+a+feature-branch+or+not',
          };
        },
      },
    ],
  },

  botUsers: ['michael-robot'],

  groups: {
    dev: {
      /* ops */
      JulienBreux: `julien.breux${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      TheR3aLp3nGuinJM: `jean-michel${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      AymenBac: `aymen${process.env.ORNIKAR_EMAIL_DOMAIN}`,

      /* back */
      abarreir: `alexandre${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      damienorny: `damien.orny${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      'Thierry-girod': `thierry${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      darame07: `kevin${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      Pixy: `pierre-alexis${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      machartier: `marie-anne${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      camillebaronnet: `camille.baronnet${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      'olivier-martinez': `olivier.martinez${process.env.ORNIKAR_EMAIL_DOMAIN}`,

      /* front */
      christophehurpeau: `christophe${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      HugoGarrido: `hugo${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      CorentinAndre: `corentin${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      Mxime: `maxime${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      vlbr: `valerian${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      'budet-b': `benjamin.budet${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      mdcarter: `maxime.dehaye${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      ChibiBlasphem: `christopher${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      PSniezak: `paul.sniezak${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      GaelFerrand: 'gael.ferrand@othrys.dev',
      aenario: `romain.foucault${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      
      /* em */
      rchabin: `remy.chabin${process.env.ORNIKAR_EMAIL_DOMAIN}`,
    },

    design: {
      jperriere: `julien${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      CoralineColasse: `coraline${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      Lenamari: `lena${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      loicleser: `loic.leser${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      carlbouville: `carl.bouville${process.env.ORNIKAR_EMAIL_DOMAIN}`,
    },
  },

  groupsGithubTeams: {
    dev: ['ops', 'backend', 'frontend', 'frontend-architects'],
    design: ['design'],
  },

  teams: {
    ops: {
      githubTeamName: 'ops',
      logins: ['JulienBreux', 'TheR3aLp3nGuinJM', 'AymenBac'],
      labels: ['teams/ops'],
    },

    backends: {
      githubTeamName: 'backend',
      logins: [
        'abarreir',
        'arthurflachs',
        'damienorny',
        'Thierry-girod',
        'darame07',
        'Pixy',
        'machartier',
        'camillebaronnet',
        'olivier-martinez',
      ],
      labels: ['teams/backend'],
    },

    frontends: {
      githubTeamName: 'frontend',
      logins: [
        'christophehurpeau',
        'HugoGarrido',
        'LentnerStefan',
        'CorentinAndre',
        'Mxime',
        'vlbr',
        'budet-b',
        'mdcarter',
        'ChibiBlasphem',
        'PSniezak',
        'aenario',
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
        name: ':vertical_traffic_light: skip-ci',
        color: '#e1e8ed',
      },
      'merge/update-branch': {
        name: ':arrows_counterclockwise: update branch',
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
