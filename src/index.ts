import 'dotenv/config';
import { Probot, Application } from 'probot';
import { AppContext } from './context/AppContext';
import mongoInit from './mongo';
import appRouter from './appRouter';
import initApp from './initApp';
import { createSlackHomeWorker } from './slack/home';

if (!process.env.REVIEWFLOW_NAME) process.env.REVIEWFLOW_NAME = 'reviewflow';
console.log({ name: process.env.REVIEWFLOW_NAME });

// const getConfig = require('probot-config')
// const { MongoClient } = require('mongodb');

// const connect = MongoClient.connect(process.env.MONGO_URL);
// const db = connect.then(client => client.db(process.env.MONGO_DB));

// let config = await getConfig(context, 'reviewflow.yml');

// eslint-disable-next-line import/no-commonjs
Probot.run((app: Application): void => {
  const mongoStores = mongoInit();
  const slackHome = createSlackHomeWorker(mongoStores);
  const appContext: AppContext = { mongoStores, slackHome };
  appRouter(app, appContext);
  initApp(app, appContext);
  slackHome.scheduleUpdateAllOrgs((id: number) => app.auth(id));
});
