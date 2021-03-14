/* eslint-disable @typescript-eslint/no-floating-promises */
import 'dotenv/config';
import { run } from 'probot';
import appRouter from './appRouter';
import type { AppContext } from './context/AppContext';
import initApp from './initApp';
import mongoInit from './mongo';
import { createSlackHomeWorker } from './slack/home';

if (!process.env.REVIEWFLOW_NAME) process.env.REVIEWFLOW_NAME = 'reviewflow';

// eslint-disable-next-line no-console
console.log({ name: process.env.REVIEWFLOW_NAME });

// const getConfig = require('probot-config')
// const { MongoClient } = require('mongodb');

// const connect = MongoClient.connect(process.env.MONGO_URL);
// const db = connect.then(client => client.db(process.env.MONGO_DB));

// let config = await getConfig(context, 'reviewflow.yml');

run((app, { getRouter }) => {
  const mongoStores = mongoInit();
  const slackHome = createSlackHomeWorker(mongoStores);
  const appContext: AppContext = { mongoStores, slackHome };
  appRouter(app, getRouter, appContext);
  initApp(app, appContext);
  slackHome.scheduleUpdateAllOrgs((id: number) => app.auth(id));
});
