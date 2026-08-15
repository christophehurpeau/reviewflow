import "dotenv/config";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import Express from "express";
import { createWsServer } from "liwi-resources-websocket-server";
import { mongoInit } from "reviewflow-core";
import type { ResourcesContext } from "./ResourcesContext.ts";
import appRouter from "./appRouter.ts";
import { getAuthenticatedUser } from "./resources/getAuthenticatedUser.ts";
import { createResourcesServerService } from "./resources/index.ts";

if (!process.env.REVIEWFLOW_NAME) process.env.REVIEWFLOW_NAME = "reviewflow";

const port = Number(process.env.PORT) || 3000;

/**
 * Resolved from the running bundle rather than the cwd: at runtime this file is
 * `packages/webapp-server/build/index-node.mjs`, next to the webapp package.
 */
const webappDistPath = fileURLToPath(
  new URL("../../webapp/dist", import.meta.url),
);

const mongoStores = mongoInit();
const resourcesContext: ResourcesContext = { mongoStores };

const expressApp = Express();

expressApp.use(cookieParser());
expressApp.use("/app", appRouter(resourcesContext));

// The webapp is a single page app: static assets first, then everything that
// is not an api or oauth route falls back to its entry point.
expressApp.use(Express.static(webappDistPath, { index: false }));
expressApp.get(/^(?!\/(?:api|app|ws)(?:\/|$)).*/, (req, res) => {
  res.sendFile(join(webappDistPath, "index.html"));
});

const server = expressApp.listen(port, () => {
  console.log(`Webapp server is running at http://localhost:${port}`);
});

const wsServer = createWsServer(
  server,
  "/ws",
  createResourcesServerService(resourcesContext),
  getAuthenticatedUser,
);

const gracefulExit = function gracefulExit(): void {
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
