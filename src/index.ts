import "dotenv/config";
import cookieParser from "cookie-parser";
import Express from "express";
import type { MongoConnection } from "liwi-mongo";
import { createNodeMiddleware, createProbot } from "probot";
import appRouter from "./appRouter.tsx";
import type { AppContext } from "./context/AppContext.ts";
import initApp from "./initApp.ts";
import mongoInit from "./mongo.ts";
import { createSlackHomeWorker } from "./slack/home.ts";

if (!process.env.REVIEWFLOW_NAME) process.env.REVIEWFLOW_NAME = "reviewflow";

// eslint-disable-next-line no-console
console.log({ name: process.env.REVIEWFLOW_NAME });

// const getConfig = require('probot-config')
// const { MongoClient } = require('mongodb');

// const connect = MongoClient.connect(process.env.MONGO_URL);
// const db = connect.then(client => client.db(process.env.MONGO_DB));

// let config = await getConfig(context, 'reviewflow.yml');

let mongoConnection: MongoConnection | null = null;

const mongoStores = mongoInit();
mongoConnection = mongoStores.connection;

const expressApp = Express();

const probot = createProbot({
  env: process.env,
});

const slackHome = createSlackHomeWorker(mongoStores, probot.log);
const appContext: AppContext = { mongoStores, slackHome };

const middleware = await createNodeMiddleware(
  (probot) => {
    initApp(probot, appContext);
  },
  {
    webhooksPath: "/api/github/webhooks",
    probot,
  },
);

expressApp.use(middleware);

expressApp.use(cookieParser());
expressApp.use("/app", await appRouter(probot, appContext));

// Use this to have SMEE...
// run((probot) => {
//   initApp(probot, appContext);
// });

const server = expressApp.listen(3000, () => {
  console.log("Server is running at http://localhost:3000");
  slackHome.scheduleUpdateAllOrgs((id) => probot.auth(id) as any);
});

const gracefulExit = function gracefulExit(): void {
  server.close();
  setTimeout(() => {
    mongoConnection?.close().then(() => {
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(0);
    });
  }, 200);
};

process.on("SIGINT", gracefulExit);
process.on("SIGTERM", gracefulExit);
