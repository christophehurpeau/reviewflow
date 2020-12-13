import type { MongoStores } from '../mongo';
import type { createSlackHomeWorker } from '../slack/home';

export interface AppContext {
  mongoStores: MongoStores;
  slackHome: ReturnType<typeof createSlackHomeWorker>;
}
