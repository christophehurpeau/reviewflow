import type { MongoStores } from "reviewflow-core";

/**
 * What the webapp server process needs: it serves the resources and the oauth
 * flows, and never talks to github as the app nor to slack.
 */
export interface ResourcesContext {
  mongoStores: MongoStores;
}
