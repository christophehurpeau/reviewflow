import "dotenv/config";
import Express from "express";
import { createNodeMiddleware, createProbot } from "probot";
import { mongoInit } from "reviewflow-core";
import type { AppContext } from "./context/AppContext.ts";
import initApp from "./initApp.ts";
import internalApiRouter from "./internalApi.ts";
import { createSlackHomeWorker } from "./slack/home.ts";
import { checkWebappUrlConfig } from "./webappUrl.ts";

if (!process.env.REVIEWFLOW_NAME) process.env.REVIEWFLOW_NAME = "reviewflow";

checkWebappUrlConfig();

// eslint-disable-next-line no-console
console.log({ name: process.env.REVIEWFLOW_NAME });

const port = Number(process.env.PORT) || 3001;
const webhooksPath = "/api/github/webhooks";

// github must reach `port` from the internet, so the internal api gets its own
// listener bound to the loopback interface instead of sharing that exposure
const internalApiPort = Number(process.env.INTERNAL_API_PORT) || 3002;
const internalApiHost = process.env.INTERNAL_API_HOST || "127.0.0.1";

const mongoStores = mongoInit();

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
    webhooksPath,
    probot,
  },
);

expressApp.use(middleware);

const internalApiApp = Express();
internalApiApp.use("/api/internal", internalApiRouter(probot, appContext));

const server = expressApp.listen(port, () => {
  console.log(`Webhook server is running at http://localhost:${port}`);
  slackHome.scheduleUpdateAllOrgs((id) => probot.auth(id) as any);
});

const internalApiServer = internalApiApp.listen(
  internalApiPort,
  internalApiHost,
  () => {
    console.log(
      `Internal api is running at http://${internalApiHost}:${internalApiPort}`,
    );
  },
);

// In development github cannot reach this machine, so smee replays the
// webhooks onto the same route the production deliveries hit.
const smeeClient = process.env.WEBHOOK_PROXY_URL
  ? await import("smee-client").then(
      ({ default: SmeeClient }) =>
        new SmeeClient({
          source: process.env.WEBHOOK_PROXY_URL!,
          target: `http://localhost:${port}${webhooksPath}`,
          logger: console,
        }),
    )
  : undefined;

await smeeClient?.start();

const gracefulExit = function gracefulExit(): void {
  smeeClient?.stop().catch(console.error);
  server.close();
  internalApiServer.close();
  setTimeout(() => {
    mongoStores.connection.close().then(() => {
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(0);
    });
  }, 200);
};

process.on("SIGINT", gracefulExit);
process.on("SIGTERM", gracefulExit);
