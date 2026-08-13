import "dotenv/config";
import { WebClient } from "@slack/web-api";
import { slackifyMarkdown } from "slackify-markdown";

const createMrkdwnSectionBlock = (text) => ({
  type: "section",
  text: {
    type: "mrkdwn",
    text,
  },
});

const slackifyCommentBodyNew = (body, multipleLines) => {
  throw new Error("Not implemented yet");
  // return markdownToBlocks(
  //   body
  //     .replace("```suggestion", "_Suggested change:_\n```suggestion")
  //     .replace(
  //       "```suggestion\r\n```",
  //       `_Suggestion to remove line${multipleLines ? "s" : ""}._\n`,
  //     ),
  // );
};

const slackifyCommentBodyOld = (body, multipleLines) => {
  return [
    createMrkdwnSectionBlock(
      slackifyMarkdown(
        body
          .replace("```suggestion", "_Suggested change:_\n```suggestion")
          .replace(
            "```suggestion\r\n```",
            `_Suggestion to remove line${multipleLines ? "s" : ""}._\n`,
          )
          .slice(0, 2000),
      ),
    ),
  ];
};

// const createSlackMessageWithSecondaryBlock = (
//   message,
//   link,
//   secondaryBlocks,
// ) => {
//   return {
//     text: message,
//     blocks: [
//       {
//         type: "section",
//         text: {
//           type: "mrkdwn",
//           text: message,
//         },
//         accessory: {
//           type: "button",
//           text: {
//             type: "plain_text",
//             text: "GitHub",
//           },
//           url: link,
//         },
//       },
//       {
//         type: "section",
//         text: {
//           type: "mrkdwn",
//           text: ":arrow_down: *Content in thread*",
//         },
//       },
//     ],
//     secondaryBlocks,
//   };
// };

const createSlackMessageWithSecondaryBlock = (
  message,
  secondaryBlockTextOrBlocks,
) => {
  return {
    text: message,
    blocks: [createMrkdwnSectionBlock(message)],
    secondaryBlocks: (() => {
      if (!secondaryBlockTextOrBlocks) return undefined;
      return Array.isArray(secondaryBlockTextOrBlocks)
        ? secondaryBlockTextOrBlocks
        : [createMrkdwnSectionBlock(secondaryBlockTextOrBlocks)];
    })(),
  };
};

if (!process.env.SLACK_TOKEN) {
  console.error("Missing slack token");
  process.exit(1);
}

const slackClient = new WebClient(process.env.SLACK_TOKEN);
// const slackUsers = new Map();
// await slackClient.paginate("users.list", {}, (page) => {
//   page.members.forEach((member) => {
//     if (member.profile && member.profile.email) {
//       slackUsers.set(member.profile.email, member);
//     }
//   });
//   return false;
// });

const im = await slackClient.conversations.open({ users: "U0141JJ4JSZ" });

// const message = await slackClient.chat.postMessage({
//   channel: im.channel.id,
//   text: "<https://github.com/ornikar/www/pull/2945|www#2945>",
//   blocks: [
//     {
//       type: "section",
//       text: {
//         type: "mrkdwn",
//         text: "👨‍🎓<https://github.com/ornikar/www/pull/2945|www#2945>",
//       },
//     },
//   ],
//   attachments: [
//     {
//       blocks: [
//         {
//           type: "section",
//           text: {
//             type: "mrkdwn",
//             text: `### :warning: Artifact update problem

// Renovate failed to update an artifact related to this branch. You probably do not want to merge this PR as-is.

// :recycle: Renovate will retry this branch, including artifacts, only when one of the following happens:

// - any of the package files in this branch needs updating, or
// - the branch becomes conflicted, or
// - you check the rebase/retry checkbox if found above, or
// - you rename this PR's title to start with "rebase!" to trigger it manually

// The artifact failure details are included below:

// ##### File name: yarn.lock

// \`\`\`
// error An unexpected error occurred: "Unknown token: { line: 3, col: 2, type: 'INVALID', value: undefined } 3:2 in /mnt/renovate/gh/christophehurpeau/eslint-config-pob/yarn.lock".

// \`\`\`
//           `,
//           },
//         },
//       ],
//     },
//   ],
// });

const body1 = `### :warning: Artifact update problem

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

<!-- This is a comment. -->

<p><a href="https://example.com" target="_blank" rel="noopener noreferrer"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cursor.com/assets/images/fix-in-web-dark.png"><source media="(prefers-color-scheme: light)" srcset="https://cursor.com/assets/images/fix-in-web-light.png"><img alt="Fix in Web" width="99" height="28" src="https://cursor.com/assets/images/fix-in-web-dark.png"></picture></a></p>

`;

const slackifiedBody1New = slackifyCommentBodyNew(body1, false);
const slackifiedBody1Old = slackifyCommentBodyOld(body1, false);

const slackifiedBody2 = await slackifyCommentBodyNew(
  "```suggestion\r\n-test\r\n+test2\r\n```",
  false,
);

const slackMessageNew = createSlackMessageWithSecondaryBlock(
  "test NEW",
  slackifiedBody1New,
);

console.log(slackifiedBody1Old);

const slackMessageOld = createSlackMessageWithSecondaryBlock(
  "test OLD",
  slackifiedBody1Old,
);

await slackClient.chat.postMessage({
  channel: im.channel.id,
  text: slackMessageOld.text,
  blocks: slackMessageOld.blocks,
  attachments: [{ blocks: slackMessageOld.secondaryBlocks }],
});

await slackClient.chat.postMessage({
  channel: im.channel.id,
  text: slackMessageNew.text,
  blocks: slackMessageNew.blocks,
  attachments: [{ blocks: slackMessageNew.secondaryBlocks }],
});

// const createMessage = (toOwner, isAssignedTo) => {
//   return ":speech_balloon: test";
// };

console.log(slackifiedBody2);

// const ownerSlackMessage = createSlackMessageWithSecondaryBlock(
//   createMessage(true, false),
//   "https://github.com/ornikar/www/pull/2945",
//   slackifiedBody1,
// );

// console.log(ownerSlackMessage.secondaryBlocks[0].text.length);

// const message2 = await slackClient.chat.postMessage({
//   channel: im.channel.id,
//   text: "<https://github.com/ornikar/www/pull/2945|www#2945>",
//   blocks: ownerSlackMessage.blocks,
//   // attachments: [{ blocks: ownerSlackMessage.secondaryBlocks }],
// });

// await slackClient.chat.postMessage({
//   channel: im.channel.id,
//   // eslint-disable-next-line camelcase
//   thread_ts: message2.ts,
//   text: "<https://github.com/ornikar/www/pull/2945|www#2945>",
//   blocks: ownerSlackMessage.secondaryBlocks,
// });
// console.log(message2);
