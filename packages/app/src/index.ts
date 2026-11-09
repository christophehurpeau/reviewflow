import { env } from "node:process";
import { appLogger } from "nightingale-app-console";
import { configPathOf } from "./config.ts";
import { createGhTransport } from "./githubTransport.ts";
import { operations } from "./operations.ts";
import { createReviewflowService } from "./reviewflowService.ts";
import { createAppServer } from "./server.ts";
import { defaultDistDirectory } from "./static.ts";

const logger = appLogger.child("server", "Server");

const defaultPort = 7450;
const host = "127.0.0.1";

const readPort = (): number => {
  const raw = env.REVIEWFLOW_APP_PORT;
  if (raw === undefined || raw === "") return defaultPort;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`REVIEWFLOW_APP_PORT is not a port: ${raw}`);
  }
  return port;
};

const port = readPort();
const configPath = configPathOf();

const server = createAppServer({
  transport: createGhTransport(),
  operations,
  configPath,
  reviewflow: createReviewflowService(),
  distDirectory: defaultDistDirectory,
  allowDevOrigins: env.REVIEWFLOW_APP_DEV === "1",
});

server.on("error", (error) => {
  logger.error("server failed", { error });
  process.exitCode = 1;
});

// loopback only: the server writes to GitHub as the user
server.listen(port, host, () => {
  logger.info("reviewflow app server listening", {
    url: `http://${host}:${String(port)}`,
    configPath,
  });
});
