import type { MongoStores } from "reviewflow-core";
import type { createSlackHomeWorker } from "../slack/home";

export interface AppContext {
  mongoStores: MongoStores;
  slackHome: ReturnType<typeof createSlackHomeWorker>;
}
