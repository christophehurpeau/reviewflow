'use strict';

require('dotenv').config();
const { WebClient } = require('@slack/web-api');

if (!process.env.SLACK_TOKEN) {
  console.error('Missing slack token');
  process.exit(1);
}

(async () => {
  const slackClient = new WebClient(process.env.SLACK_TOKEN);
  const slackUsers = new Map();
  await slackClient.paginate('users.list', {}, (page) => {
    page.members.forEach((member) => {
      if (member.profile && member.profile.email) {
        slackUsers.set(member.profile.email, member);
      }
    });
    return false;
  });

  const member = slackUsers.get('christophe@ornikar.com');

  const im = await slackClient.im.open({ user: member.id });

  const message = await slackClient.chat.postMessage({
    channel: im.channel.id,
    text: '<https://github.com/ornikar/www/pull/2945|www#2945>',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '👨‍🎓<https://github.com/ornikar/www/pull/2945|www#2945>',
        },
      },
    ],
    attachments: [
      {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `### :warning: Artifact update problem

Renovate failed to update an artifact related to this branch. You probably do not want to merge this PR as-is.

:recycle: Renovate will retry this branch, including artifacts, only when one of the following happens:

- any of the package files in this branch needs updating, or
- the branch becomes conflicted, or
- you check the rebase/retry checkbox if found above, or
- you rename this PR's title to start with "rebase!" to trigger it manually

The artifact failure details are included below:

##### File name: yarn.lock

\`\`\`
error An unexpected error occurred: "Unknown token: { line: 3, col: 2, type: 'INVALID', value: undefined } 3:2 in /mnt/renovate/gh/christophehurpeau/eslint-config-pob/yarn.lock".

\`\`\`
          `,
            },
          },
        ],
      },
    ],
  });
  console.log(message);
})();
