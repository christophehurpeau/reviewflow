/* eslint-disable max-lines */

'use strict';

const { obtainRepoContext } = require('./context/repoContext');
const openedHandler = require('./pr-handlers/opened');
const reviewRequestedHandler = require('./pr-handlers/reviewRequested');
const reviewRequestRemovedHandler = require('./pr-handlers/reviewRequestRemoved');
const reviewSubmittedHandler = require('./pr-handlers/reviewSubmitted');
const reviewDismissedHandler = require('./pr-handlers/reviewDismissed');
const synchromizeHandler = require('./pr-handlers/synchronize');
const editedHandler = require('./pr-handlers/edited');

if (!process.env.NAME) process.env.NAME = 'reviewflow';

// const getConfig = require('probot-config')
// const { MongoClient } = require('mongodb');

// const connect = MongoClient.connect(process.env.MONGO_URL);
// const db = connect.then(client => client.db(process.env.MONGO_DB));

// let config = await getConfig(context, 'reviewflow.yml');

const createHandlerPullRequestChange = (handler, ignoreFilter) => async (
  context
) => {
  if (ignoreFilter && ignoreFilter(context)) return;

  const repoContext = await obtainRepoContext(context);
  if (!repoContext) return;

  return repoContext.lockPR(context, async () => {
    await handler(repoContext, context);
  });
};

/*
 * This is the entry point for your Probot App.
 * @param {import('probot').Application} app - Probot's Application class.
 */
module.exports = (app) => {
  app.on('pull_request.opened', createHandlerPullRequestChange(openedHandler));

  app.on(
    'pull_request.review_requested',
    createHandlerPullRequestChange(reviewRequestedHandler)
  );

  app.on(
    'pull_request.review_request_removed',
    createHandlerPullRequestChange(reviewRequestRemovedHandler)
  );

  // app.on('pull_request.closed', async context => {

  // });

  // app.on('pull_request.reopened', async context => {

  // });

  app.on(
    'pull_request_review.submitted',
    createHandlerPullRequestChange(reviewSubmittedHandler)
  );

  app.on(
    'pull_request_review.dismissed',
    createHandlerPullRequestChange(reviewDismissedHandler)
  );

  app.on(
    ['pull_request.labeled', 'pull_request.unlabeled'],
    createHandlerPullRequestChange(
      async (repoContext, context) => {
        await repoContext.updateStatusCheckFromLabels(context);
      },
      (context) => {
        const sender = context.payload.sender;
        return sender.type === 'Bot';
      }
    )
  );

  app.on(
    'pull_request.synchronize',
    createHandlerPullRequestChange(synchromizeHandler)
  );

  app.on('pull_request.edited', createHandlerPullRequestChange(editedHandler));
};
