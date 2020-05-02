'use strict';

require('dotenv').config();
const { WebClient } = require('@slack/web-api');

if (!process.env.ORNIKAR_SLACK_TOKEN) {
  console.error('Missing slack token');
  process.exit(1);
}

(async () => {
  const slackClient = new WebClient(process.env.ORNIKAR_SLACK_TOKEN);
  const allUsers = await slackClient.users.list({ limit: 200 });
  const member = allUsers.members.find(
    (user) => user.profile.email === 'christophe@ornikar.com',
  );
  const im = await slackClient.im.open({ user: member.id });

  await slackClient.chat.postMessage({
    channel: im.channel.id,
    text: '<https://github.com/ornikar/www/pull/2945|www#2945>',
  });
})();
