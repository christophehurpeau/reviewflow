'use strict';

const { WebClient } = require('@slack/client');

const initTeamSlack = async (context, config) => {
  const githubLoginToSlackEmail = { ...config.dev, ...config.design };

  const slackClient = new WebClient(config.slackToken);
  const allUsers = await slackClient.users.list({ limit: 200 });
  const members = new Map(
    [...Object.values(config.dev), ...Object.values(config.design)].map(email => {
      const member = allUsers.members.find(user => user.profile.email === email);
      if (!member) {
        console.warn(`Could not find user ${email}`);
      }
      return [email, { member }];
    })
  );

  for (const user of members.values()) {
    try {
      const im = await slackClient.im.open({ user: user.member.id });
      user.im = im.channel;
    } catch (err) {
      console.error(err);
    }
  }

  const getUserFromGithubLogin = githubLogin => {
    const email = githubLoginToSlackEmail[githubLogin];
    if (!email) return null;
    return members.get(email);
  };

  return {
    mention: githubLogin => {
      const user = getUserFromGithubLogin(githubLogin);
      if (!user) return githubLogin;
      return `<@${user.member.id}>`;
    },
    postMessage: (githubLogin, text) => {
      context.log.info('send slack', { githubLogin, text });
      if (process.env.DRY_RUN) return;

      const user = getUserFromGithubLogin(githubLogin);
      if (!user || !user.im) return;
      return slackClient.chat.postMessage({
        channel: user.im.id,
        text,
      });
    },
  };
};

module.exports = initTeamSlack;
