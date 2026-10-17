import type { Server } from "node:http";
import type { RelayedStore } from "liwi-resources-server";
import {
  ResourcesServerService,
  createStoreRelayResource,
} from "liwi-resources-server";
import type { ResourcesWebsocketServer } from "liwi-resources-websocket-server";
import { createWsServer } from "liwi-resources-websocket-server";
import { STORE_RELAY_PATH, STORE_RELAY_RESOURCE_NAME } from "reviewflow-core";
import { hasInternalApiSecret } from "./internalApiSecret.ts";

const RELAY_READER = "webapp-server";
type RelayReader = typeof RELAY_READER;

export interface CreateStoreRelayServerOptions {
  /** the internal api listener: the webapp server alone can reach it */
  server: Server;
  stores: Record<string, RelayedStore>;
  secret: string;
  heartbeatIntervalMs?: number;
}

/**
 * Sends the keys the bot writes to the webapp server, which re-reads them for
 * its subscriptions. While the webapp server is connected, every write to
 * `stores` also reads the document it replaces.
 */
export const createStoreRelayServer = ({
  server,
  stores,
  secret,
  heartbeatIntervalMs,
}: CreateStoreRelayServerOptions): ResourcesWebsocketServer =>
  createWsServer<RelayReader>(
    server,
    STORE_RELAY_PATH,
    new ResourcesServerService({
      serviceResources: new Map([
        [
          STORE_RELAY_RESOURCE_NAME,
          createStoreRelayResource<RelayReader>({
            stores,
            authorize: (reader) => reader === RELAY_READER,
            heartbeatIntervalMs,
          }),
        ],
      ]),
    }),
    (request) =>
      hasInternalApiSecret(request.headers.authorization, secret)
        ? RELAY_READER
        : null,
  );
