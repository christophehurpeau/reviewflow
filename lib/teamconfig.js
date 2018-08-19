'use strict';

module.exports = {
  slackToken: process.env.ORNIKAR_SLACK_TOKEN,
  autoAssignToCreator: true,
  dev: {
    abarreir: `alexandre${process.env.ORNIKAR_EMAIL_DOMAIN}`,
    christophehurpeau: `christophe${process.env.ORNIKAR_EMAIL_DOMAIN}`,
    arthurflachs: `arthur${process.env.ORNIKAR_EMAIL_DOMAIN}`,
    skyline42sh: `alexandre.charbonnier${process.env.ORNIKAR_EMAIL_DOMAIN}`,
    LentnerStefan: `stefan${process.env.ORNIKAR_EMAIL_DOMAIN}`,
    HugoGarrido: `hugo${process.env.ORNIKAR_EMAIL_DOMAIN}`,
  },
  design: {
    jperriere: `julien${process.env.ORNIKAR_EMAIL_DOMAIN}`,
  },
  waitForGroups: {
    dev: [],
    design: ['devs'],
  },
  labels: {
    list: {
      // /* ci */
      // 'ci/in-progress': { name: ':green_heart: ci/in-progress', color: '#0052cc' },
      // 'ci/fail': { name: ':green_heart: ci/fail', color: '#e11d21' },
      // 'ci/passed': { name: ':green_heart: ci/passed', color: '#86f9b4' },
      // /* code */
      'code/review-requested': {
        name: ':ok_hand: code/review-requested',
        color: '#fef2c0',
      },
      'code/changes-requested': {
        name: ':ok_hand: code/changes-requested',
        color: '#e11d21',
      },
      'code/approved': { name: ':ok_hand: code/approved', color: '#86f9b4' },
      /* design */
      'design/needs-review': {
        name: ':art: design/needs-review',
        color: '#fef2c0',
      },
      'design/review-requested': {
        name: ':art: design/review-requested',
        color: '#fef2c0',
      },
      'design/changes-requested': {
        name: ':art: design/changes-requested',
        color: '#e11d21',
      },
      'design/approved': { name: ':art: design/approved', color: '#86f9b4' },
    },

    review: {
      ci: {
        inProgress: 'ci/in-progress',
        succeeded: 'ci/success',
        failed: 'ci/fail',
      },
      dev: {
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
