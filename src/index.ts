import type { MongoConnection } from 'liwi-mongo';
/* eslint-disable @typescript-eslint/no-floating-promises */
import 'dotenv/config';
import { run } from 'probot';
import appRouter from './appRouter';
import type { AppContext } from './context/AppContext';
import initApp from './initApp';
import initScheduler from './initScheduler';
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

const mongoStores = mongoInit();
const mongoConnection: MongoConnection = mongoStores.connection;
const slackHome = createSlackHomeWorker(mongoStores);
const appContext: AppContext = { mongoStores, slackHome };

const serverPromise = run((app, { getRouter }) => {
  appRouter(app, getRouter, appContext);
  initApp(app, appContext);
  initScheduler(app, appContext);
  slackHome.scheduleUpdateAllOrgs((id: number) => app.auth(id));
});

const gracefulExit = function (): void {
  Promise.all([
    serverPromise.then((server) => server.stop()),
    mongoConnection?.close(),
  ]).then(() => {
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(0);
  });
};

process.on('SIGINT', gracefulExit);
process.on('SIGTERM', gracefulExit);
