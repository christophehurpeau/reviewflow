import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type {
  RelayTargetStore,
  StoreRelayConnection,
  TransportClient,
} from "liwi-resources-client";
import { connectStoreRelay } from "liwi-resources-client";
import type { RelayedStore } from "liwi-resources-server";
import { createNodeWebsocketTransportClient } from "liwi-resources-websocket-client-node";
import type { ResourcesWebsocketServer } from "liwi-resources-websocket-server";
import type { AllowedKeyValue } from "liwi-store";
import nock from "nock";
import { STORE_RELAY_PATH, STORE_RELAY_RESOURCE_NAME } from "reviewflow-core";
import { createStoreRelayServer } from "./storeRelay.ts";

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

describe("createStoreRelayServer", () => {
  const prs = createFakeProducerStore();
  let server: Server;
  let relayServer: ResourcesWebsocketServer;
  let url: string;
  const opened: {
    transportClient: TransportClient;
    relay: StoreRelayConnection;
  }[] = [];

  const connect = (
    authorization: string,
  ): { target: FakeTargetStore; errors: unknown[] } => {
    const target = createFakeTargetStore();
    const errors: unknown[] = [];
    const transportClient = createNodeWebsocketTransportClient({
      url,
      headers: { authorization },
    });
    transportClient.connect();
    const relay = connectStoreRelay({
      transportClient,
      resourceName: STORE_RELAY_RESOURCE_NAME,
      stores: { prs: target },
      onError: (error) => errors.push(error),
    });
    opened.push({ transportClient, relay });
    return { target, errors };
  };

  beforeAll(async () => {
    nock.enableNetConnect("127.0.0.1");
    server = createServer();
    relayServer = createStoreRelayServer({ server, stores: { prs }, secret });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const { port } = server.address() as AddressInfo;
    url = `ws://127.0.0.1:${port}${STORE_RELAY_PATH}`;
  });

  afterEach(() => {
    opened.splice(0).forEach(({ transportClient, relay }) => {
      relay.close();
      transportClient.close();
    });
  });

  afterAll(async () => {
    relayServer.close();
    await new Promise((resolve) => {
      server.close(resolve);
    });
    nock.disableNetConnect();
  });

  it("resyncs once live, then forwards the written keys", async () => {
    const { target, errors } = connect(`Bearer ${secret}`);

    await expect.poll(() => target.resyncCount).toBe(1);
    prs.write(["6512f0c4e1a2b3c4d5e6f701", 42]);

    await expect
      .poll(() => target.notified)
      .toEqual([["6512f0c4e1a2b3c4d5e6f701", 42]]);
    expect(errors).toEqual([]);
  });

  it("refuses a connection without the internal api secret", async () => {
    const { target, errors } = connect("Bearer wrong-secret");

    await expect
      .poll(() => errors)
      .toEqual([expect.objectContaining({ code: "FORBIDDEN" })]);
    prs.write(["6512f0c4e1a2b3c4d5e6f701"]);
    expect(target.resyncCount).toBe(0);
    expect(target.notified).toEqual([]);
  });
});
