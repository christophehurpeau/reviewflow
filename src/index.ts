import 'dotenv/config';
import { Probot, Application } from 'probot';
import openedHandler from './pr-handlers/opened';
import closedHandler from './pr-handlers/closed';
import reviewRequestedHandler from './pr-handlers/reviewRequested';
import reviewRequestRemovedHandler from './pr-handlers/reviewRequestRemoved';
import reviewSubmittedHandler from './pr-handlers/reviewSubmitted';
import reviewDismissedHandler from './pr-handlers/reviewDismissed';
import synchromizeHandler from './pr-handlers/synchronize';
import editedHandler from './pr-handlers/edited';
import labelsChanged from './pr-handlers/labelsChanged';
import checkrunCompleted from './pr-handlers/checkrunCompleted';
import checksuiteCompleted from './pr-handlers/checksuiteCompleted';
import status from './pr-handlers/status';
import mongoInit from './mongo';
import appRouter from './appRouter';

if (!process.env.REVIEWFLOW_NAME) process.env.REVIEWFLOW_NAME = 'reviewflow';
console.log({ name: process.env.REVIEWFLOW_NAME });

// const getConfig = require('probot-config')
// const { MongoClient } = require('mongodb');

// const connect = MongoClient.connect(process.env.MONGO_URL);
// const db = connect.then(client => client.db(process.env.MONGO_DB));

// let config = await getConfig(context, 'reviewflow.yml');

// eslint-disable-next-line import/no-commonjs
Probot.run((app: Application) => {
  const mongoStores = mongoInit();
  appRouter(app, mongoStores);

  openedHandler(app);
  closedHandler(app);
  reviewRequestedHandler(app);
  reviewRequestRemovedHandler(app);

  // app.on('pull_request.closed', async context => {

  // });

  // app.on('pull_request.reopened', async context => {

  // });

  reviewSubmittedHandler(app);
  reviewDismissedHandler(app);
  labelsChanged(app);
  synchromizeHandler(app);
  editedHandler(app);

  checkrunCompleted(app);
  checksuiteCompleted(app);
  status(app);
});
