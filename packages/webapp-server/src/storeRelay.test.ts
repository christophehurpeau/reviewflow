import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type {
  RelayTargetStore,
  StoreRelayConnection,
} from "liwi-resources-client";
import type { RelayedStore } from "liwi-resources-server";
import {
  ResourcesServerService,
  createStoreRelayResource,
} from "liwi-resources-server";
import type { ResourcesWebsocketServer } from "liwi-resources-websocket-server";
import { createWsServer } from "liwi-resources-websocket-server";
import type { AllowedKeyValue } from "liwi-store";
import { STORE_RELAY_PATH, STORE_RELAY_RESOURCE_NAME } from "reviewflow-core";
import { connectBotStoreRelay } from "./storeRelay.ts";

const secret = "internal-secret";

interface FakeProducerStore extends RelayedStore {
  write: (keys: AllowedKeyValue[]) => void;
}

const createFakeProducerStore = (): FakeProducerStore => {
  const callbacks = new Set<(keys: AllowedKeyValue[]) => unknown>();
  return {
    subscribeChangedKeys: (callback) => {
      callbacks.add(callback);
      return () => callbacks.delete(callback);
    },
    write: (keys) => {
      callbacks.forEach((callback) => callback(keys));
    },
  };
};

interface FakeTargetStore extends RelayTargetStore {
  notified: AllowedKeyValue[][];
  resyncCount: number;
}

const createFakeTargetStore = (): FakeTargetStore => {
  const store: FakeTargetStore = {
    notified: [],
    resyncCount: 0,
    notifyChanged: (keys) => {
      store.notified.push(keys);
      return Promise.resolve();
    },
    resync: () => {
      store.resyncCount++;
    },
  };
  return store;
};

interface FakeBot {
  prs: FakeProducerStore;
  listen: (port?: number) => Promise<number>;
  close: () => Promise<void>;
}

/** the bot's side, as `reviewflow/src/storeRelay.ts` serves it */
const createFakeBot = (): FakeBot => {
  const prs = createFakeProducerStore();
  let server: Server | undefined;
  let wsServer: ResourcesWebsocketServer | undefined;

  return {
    prs,
    listen: async (port = 0) => {
      const listening = createServer();
      server = listening;
      wsServer = createWsServer(
        listening,
        STORE_RELAY_PATH,
        new ResourcesServerService({
          serviceResources: new Map([
            [
              STORE_RELAY_RESOURCE_NAME,
              createStoreRelayResource<string>({
                stores: { prs },
                authorize: (reader) => reader === "webapp-server",
              }),
            ],
          ]),
        }),
        (request) =>
          request.headers.authorization === `Bearer ${secret}`
            ? "webapp-server"
            : null,
      );
      await new Promise<void>((resolve) => {
        listening.listen(port, "127.0.0.1", resolve);
      });
      return (listening.address() as AddressInfo).port;
    },
    close: async () => {
      wsServer?.close();
      const closing = server;
      if (!closing) return;
      await new Promise((resolve) => {
        closing.close(resolve);
      });
    },
  };
};

describe("connectBotStoreRelay", () => {
  const cleanups: (() => Promise<void> | void)[] = [];

  afterEach(async () => {
    for (const cleanup of cleanups.splice(0).toReversed()) await cleanup();
  });

  const connect = (port: number): FakeTargetStore => {
    const prs = createFakeTargetStore();
    const relay: StoreRelayConnection = connectBotStoreRelay({
      botInternalUrl: `http://127.0.0.1:${port}`,
      secret,
      stores: { prs },
    });
    cleanups.push(relay.close);
    return prs;
  };

  it("feeds the stores with the keys the bot writes", async () => {
    const bot = createFakeBot();
    cleanups.push(bot.close);
    const port = await bot.listen();

    const prs = connect(port);
    await expect.poll(() => prs.resyncCount).toBe(1);
    bot.prs.write(["6512f0c4e1a2b3c4d5e6f701"]);

    await expect
      .poll(() => prs.notified)
      .toEqual([["6512f0c4e1a2b3c4d5e6f701"]]);
  });

  it("connects once the bot is up, when it started first", async () => {
    const probe = createFakeBot();
    const port = await probe.listen();
    await probe.close();

    const prs = connect(port);
    const bot = createFakeBot();
    cleanups.push(bot.close);
    await bot.listen(port);

    await expect.poll(() => prs.resyncCount, { timeout: 10_000 }).toBe(1);
  });
});
