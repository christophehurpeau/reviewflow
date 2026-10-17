import "dotenv/config";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import Express from "express";
import { createWsServer } from "liwi-resources-websocket-server";
import { getRelayedStores, mongoInit } from "reviewflow-core";
import type { ResourcesContext } from "./ResourcesContext.ts";
import apiRouter from "./api/apiRouter.ts";
import appRouter from "./appRouter.ts";
import { getBotInternalUrl } from "./botApi.ts";
import { getAuthenticatedUser } from "./resources/getAuthenticatedUser.ts";
import { createResourcesServerService } from "./resources/index.ts";
import { createSlackUserTokensCheck } from "./resources/slackUserToken.ts";
import { connectBotStoreRelay } from "./storeRelay.ts";

if (!process.env.REVIEWFLOW_NAME) process.env.REVIEWFLOW_NAME = "reviewflow";

const port = Number(process.env.PORT) || 3000;

/**
 * Resolved from the running bundle rather than the cwd: at runtime this file is
 * `packages/webapp-server/build/index-node.mjs`, next to the webapp package.
 */
const webappDistPath = fileURLToPath(
  new URL("../../webapp/dist", import.meta.url),
);

const internalApiSecret = process.env.INTERNAL_API_SECRET;
if (!internalApiSecret) {
  throw new Error("Missing env variable: INTERNAL_API_SECRET");
}

const mongoStores = mongoInit();
const resourcesContext: ResourcesContext = { mongoStores };

const storeRelay = connectBotStoreRelay({
  botInternalUrl: getBotInternalUrl(),
  secret: internalApiSecret,
  stores: getRelayedStores(mongoStores),
});

const expressApp = Express();

// behind the reverse proxy `req.ip` is the proxy's address: TRUST_PROXY takes
// express's values ("loopback", a subnet...) so the api records the caller's
// own ip on its tokens
if (process.env.TRUST_PROXY) {
  expressApp.set("trust proxy", process.env.TRUST_PROXY);
}

expressApp.use(cookieParser());
expressApp.use("/app", appRouter(resourcesContext));
expressApp.use("/api", apiRouter(resourcesContext));

// The webapp is a single page app: static assets first, then everything that
// is not an api or oauth route falls back to its entry point.
expressApp.use(Express.static(webappDistPath, { index: false }));
expressApp.get(/^(?!\/(?:api|app|ws)(?:\/|$)).*/, (req, res) => {
  res.sendFile(join(webappDistPath, "index.html"));
});

const server = expressApp.listen(port, () => {
  console.log(`Webapp server is running at http://localhost:${port}`);
});

const checkSlackUserTokens = createSlackUserTokensCheck(mongoStores);

const wsServer = createWsServer(
  server,
  "/ws",
  createResourcesServerService(resourcesContext),
  async (request) => {
    const user = await getAuthenticatedUser(request);
    // when the user opens the app, so a revoked slack sign-in asks to sign in again
    if (user) {
      checkSlackUserTokens(user.id).catch((error: unknown) => {
        console.error("Could not check the slack user tokens", error);
      });
    }
    return user;
  },
);

const gracefulExit = function gracefulExit(): void {
  storeRelay.close();
  wsServer.close();
  server.close();
  setTimeout(() => {
    mongoStores.connection.close().then(() => {
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(0);
    });
  }, 200);
};

process.on("SIGINT", gracefulExit);
process.on("SIGTERM", gracefulExit);
