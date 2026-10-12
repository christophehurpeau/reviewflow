import type { MongoStores } from "reviewflow-core";

/**
 * What the webapp server process needs: it serves the resources and the oauth
 * flows, and never talks to github as the app nor to slack as the bot (it only
 * uses a user's own slack token, to sign them in and check it).
 */
export interface ResourcesContext {
  mongoStores: MongoStores;
}
