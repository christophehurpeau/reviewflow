import type {
  RelayTargetStore,
  StoreRelayConnection,
} from "liwi-resources-client";
import { connectStoreRelay } from "liwi-resources-client";
import { createNodeWebsocketTransportClient } from "liwi-resources-websocket-client-node";
import { Logger } from "nightingale-logger";
import { STORE_RELAY_PATH, STORE_RELAY_RESOURCE_NAME } from "reviewflow-core";

const logger = new Logger("reviewflow:webapp-server:storeRelay");

export interface ConnectBotStoreRelayOptions {
  /** the bot's internal api, `http(s)://host:port` */
  botInternalUrl: string;
  secret: string;
  stores: Record<string, RelayTargetStore<any>>;
}

/**
 * Feeds `stores` with the writes of the bot, so the subscriptions of this
 * process see them. The bot may be down: the connection is retried in the
 * background, and each (re)connection makes every subscription refetch.
 */
export const connectBotStoreRelay = ({
  botInternalUrl,
  secret,
  stores,
}: ConnectBotStoreRelayOptions): StoreRelayConnection => {
  const transportClient = createNodeWebsocketTransportClient({
    url: `${botInternalUrl.replace(/^http/, "ws")}${STORE_RELAY_PATH}`,
    headers: { authorization: `Bearer ${secret}` },
  });
  transportClient.connect();

  let wasLive = false;
  const relay = connectStoreRelay({
    transportClient,
    resourceName: STORE_RELAY_RESOURCE_NAME,
    stores,
    onStateChange: ({ isLive }) => {
      if (isLive === wasLive) return;
      wasLive = isLive;
      logger.info(
        isLive
          ? "Store relay from the bot is live"
          : "Store relay from the bot is disconnected, reconnecting",
      );
    },
    onError: (error) => {
      logger.error("Store relay from the bot failed", { error });
    },
  });

  return {
    getState: relay.getState,
    close: () => {
      relay.close();
      transportClient.close();
    },
  };
};
