const { WebClient } = require('@slack/client');
const config = require('./teamconfig');
// const getConfig = require('probot-config')
// const { MongoClient } = require('mongodb');

// const connect = MongoClient.connect(process.env.MONGO_URL);
// const db = connect.then(client => client.db(process.env.MONGO_DB));

// let config = await getConfig(context, 'reviewflow.yml');

const teamContexts = {};

const obtainTeamContext = async (context) => {
  const owner = context.payload.repository.owner;
  if (owner.login !== 'ornikar') {
    console.warn(owner.login);
    return null;
  }
  if (teamContexts[owner.login]) return teamContexts[owner.login];

  

  const githubLoginToSlackEmail = { ...config.devs, ...config.designers };

  const slackClient = new WebClient(config.slackToken);
  const allUsers = await slackClient.users.list({ limit: 200 });
  const members = new Map([...Object.values(config.devs), ...Object.values(config.designers)].map(email => {
    const member = allUsers.members.find(user => user.profile.email === email);
    if (!member) {
      console.warn('Could not find user '+email);
    }
    return [email, {member}];
  }));

  for (const user of members.values()) {
    try {
      const im = await slackClient.im.open({ user: user.member.id });
      user.im = im.channel;
    } catch (err) {
      console.error(err);
    }
  }

  const getUserFromGithubLogin = (githubLogin) => {
    const email = githubLoginToSlackEmail[githubLogin];
    if (!email) return null;
    return members.get(email);
  }

  teamContexts[owner.login] = { 
    slackMention: (githubLogin) => {
      const user = getUserFromGithubLogin(githubLogin);
      if (!user) return githubLogin;
      return `<@${user.member.id}>`
    },
    postMessage: (githubLogin, text) => {
      const user = getUserFromGithubLogin(githubLogin);
      if (!user || !user.im) return;
      return slackClient.chat.postMessage({
        channel: user.im.id,
        text, 
      });
    }
  };

  return teamContexts[owner.login];
}


/* 
* This is the entry point for your Probot App.
* @param {import('probot').Application} app - Probot's Application class.
*/
module.exports = async (app) => {
  app.on('pull_request.review_requested', async context => {
    const teamContext = await obtainTeamContext(context);
    if (!teamContext) return;
    const sender = context.payload.sender;
    const pr = context.payload.pull_request;
    const reviewer = context.payload.requested_reviewer;
    if (sender.login === reviewer.login) return;
    teamContext.postMessage(reviewer.login, `${teamContext.slackMention(sender.login)} requested your review on ${pr.html_url}`);
  });

  app.on('pull_request.review_request_removed', async context => {
    const teamContext = await obtainTeamContext(context);
    if (!teamContext) return;
    const sender = context.payload.sender;
    const pr = context.payload.pull_request;
    const reviewer = context.payload.requested_reviewer;
    if (sender.login === reviewer.login) return;
    teamContext.postMessage(reviewer.login, `${teamContext.slackMention(sender.login)} removed the request for your review on ${pr.html_url}`);
  });

  // app.on('pull_request.closed', async context => {

  // });

  // app.on('pull_request.reopened', async context => {

  // });

  app.on('pull_request_review.submitted', async context => {
    const teamContext = await obtainTeamContext(context);
    if (!teamContext) return;
    const pr = context.payload.pull_request;
    const { user: reviewer, state } = context.payload.review;
    if (pr.user.login === reviewer.login) return;
    const message = (() => {
      if (state === 'changes_requested') return ':x: requested changes on';
      if (state === 'approved') return ':white_check_mark: approved';
      return 'commented on'
    })()
    teamContext.postMessage(pr.user.login, `${teamContext.slackMention(reviewer.login)} ${message} ${pr.html_url}`);
  });

  app.on('pull_request_review.dismissed', async context => {
    const teamContext = await obtainTeamContext(context);
    if (!teamContext) return;
    const sender = context.payload.sender;
    const pr = context.payload.pull_request;
    const reviewer = context.payload.review.user;
    if (sender.login === reviewer.login) {
      teamContext.postMessage(pr.user.login, `${teamContext.slackMention(reviewer.login)} dismissed his review on ${pr.html_url}`);
    } else {
      teamContext.postMessage(reviewer.login, `${teamContext.slackMention(sender.login)} dismissed your review on ${pr.html_url}, he requests a new one !`);
    }
  });
}
