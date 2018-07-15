'use strict';

module.exports = {
  slackToken: process.env.ORNIKAR_SLACK_TOKEN,
  devs: {
    abarreir: `alexandre${process.env.ORNIKAR_EMAIL_DOMAIN}`,
    christophehurpeau: `christophe${process.env.ORNIKAR_EMAIL_DOMAIN}`,
    arthurflachs: `arthur${process.env.ORNIKAR_EMAIL_DOMAIN}`,
    skyline42sh: `alexandre.charbonnier${process.env.ORNIKAR_EMAIL_DOMAIN}`,
    LentnerStefan: `stefan${process.env.ORNIKAR_EMAIL_DOMAIN}`,
    HugoGarrido: `hugo${process.env.ORNIKAR_EMAIL_DOMAIN}`,
  },
  designers: {
    jperriere: `julien${process.env.ORNIKAR_EMAIL_DOMAIN}`,
  },
  tags: {
    review: {
      dev: {
        inProgress: 'code-review-requested',
        changesRequested: 'code-changes-requested',
        approved: 'code-approved',
      },
      design: {
        needsReview: 'needs-design-review',
        inProgress: 'design-review-requested',
        changesRequested: 'design-changes-requested',
        approved: 'design-approved',
      },
    },
  },
};
