import type { MongoStores } from "./mongo.ts";

/** websocket path of the relay, on the bot's internal api listener */
export const STORE_RELAY_PATH = "/api/internal/store-relay";
export const STORE_RELAY_RESOURCE_NAME = "storeRelay";

/**
 * The stores the bot writes and the webapp server subscribes to. Both sides
 * take them from here: their names are the relay's wire identifiers.
 */
export const getRelayedStores = (
  mongoStores: MongoStores,
): Pick<
  MongoStores,
  "orgMembers" | "orgs" | "prs" | "repositories" | "users"
> => ({
  orgMembers: mongoStores.orgMembers,
  orgs: mongoStores.orgs,
  prs: mongoStores.prs,
  repositories: mongoStores.repositories,
  users: mongoStores.users,
});
