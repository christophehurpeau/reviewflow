import 'dotenv/config';
import { WebClient } from '@slack/web-api';
import { markdownToBlocks } from '@tryfabric/mack';

export const slackifyCommentBody = (body, multipleLines) => {
  return markdownToBlocks(
    body
      .replace('```suggestion', '_Suggested change:_\n```suggestion')
      .replace(
        '```suggestion\r\n```',
        `_Suggestion to remove line${multipleLines ? 's' : ''}._\n`,
      ),
  );
};

const createSlackMessageWithSecondaryBlock = (
  message,
  link,
  secondaryBlocks,
) => {
  return {
    text: message,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: message,
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'GitHub',
          },
          url: link,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':arrow_down: *Content in thread*',
        },
      },
    ],
    secondaryBlocks,
  };
};

if (!process.env.SLACK_TOKEN) {
  console.error('Missing slack token');
  process.exit(1);
}

const slackClient = new WebClient(process.env.SLACK_TOKEN);
// const slackUsers = new Map();
// await slackClient.paginate('users.list', {}, (page) => {
//   page.members.forEach((member) => {
//     if (member.profile && member.profile.email) {
//       slackUsers.set(member.profile.email, member);
//     }
//   });
//   return false;
// });

// const member = slackUsers.get('christophe@ornikar.com');

const im = await slackClient.conversations.open({ users: 'U8ZM3VBA4' });

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

const slackifiedBody1 = await slackifyCommentBody(message, false);

const slackifiedBody2 = await slackifyCommentBody(
  '```suggestion\r\n-test\r\n+test2\r\n```',
  false,
);

const createMessage = (toOwner, isAssignedTo) => {
  return ':speech_balloon: test';
};

console.log(slackifiedBody2);

const ownerSlackMessage = createSlackMessageWithSecondaryBlock(
  createMessage(true, false),
  'https://github.com/ornikar/www/pull/2945',
  slackifiedBody1,
);

// console.log(ownerSlackMessage.secondaryBlocks[0].text.length);

const message2 = await slackClient.chat.postMessage({
  channel: im.channel.id,
  text: '<https://github.com/ornikar/www/pull/2945|www#2945>',
  blocks: ownerSlackMessage.blocks,
  // attachments: [{ blocks: ownerSlackMessage.secondaryBlocks }],
});

await slackClient.chat.postMessage({
  channel: im.channel.id,
  // eslint-disable-next-line camelcase
  thread_ts: message2.ts,
  text: '<https://github.com/ornikar/www/pull/2945|www#2945>',
  blocks: ownerSlackMessage.secondaryBlocks,
});
console.log(message2);
