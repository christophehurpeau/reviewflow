'use strict';

const initTeamSlack = require('./initTeamSlack');

const initTeamContext = async (context, config) => {
  const slackPromise = initTeamSlack(context, config);

  const githubLoginToGroup = new Map([
    ...Object.keys(config.dev || {}).map(login => [login, 'dev']),
    ...Object.keys(config.design || {}).map(login => [login, 'design']),
  ]);

  const getReviewerGroups = githubLogins => [
    ...new Set(
      githubLogins.map(githubLogin => githubLoginToGroup.get(githubLogin)).filter(Boolean)
    ),
  ];

  return {
    config,
    getReviewerGroup: githubLogin => githubLoginToGroup.get(githubLogin),
    getReviewerGroups: githubLogins => [
      ...new Set(
        githubLogins.map(githubLogin => githubLoginToGroup.get(githubLogin)).filter(Boolean)
      ),
    ],

    reviewShouldWait: (
      reviewerGroup,
      requestedReviewers,
      { includesReviewerGroup, includesWaitForGroups }
    ) => {
      if (!reviewerGroup) return false;

      const requestedReviewerGroups = getReviewerGroups(
        requestedReviewers.map(request => request.login)
      );

      // contains another request of a reviewer in the same group
      if (includesReviewerGroup && requestedReviewerGroups.includes(reviewerGroup)) return true;

      // contains a request from a dependent group
      if (includesWaitForGroups)
        return requestedReviewerGroups.some(group =>
          config.waitForGroups[reviewerGroup].includes(group)
        );

      return false;
    },

    slack: await slackPromise,
  };
};

const teamContextsPromise = new Map();
const teamContexts = new Map();

exports.obtainTeamContext = (context, config) => {
  const owner = context.payload.repository.owner;
  if (owner.login !== 'ornikar') {
    console.warn(owner.login);
    return null;
  }

  const existingTeamContext = teamContexts.get(owner.login);
  if (existingTeamContext) return existingTeamContext;

  const existingPromise = teamContextsPromise.get(owner.login);
  if (existingPromise) return Promise.resolve(existingPromise);

  const promise = initTeamContext(context, config);
  teamContextsPromise.set(owner.login, promise);

  return promise.then(teamContext => {
    teamContextsPromise.delete(owner.login);
    teamContexts.set(owner.login, teamContext);
    return teamContext;
  });
};
