import { MongoStores } from '../mongo';
import { createSlackHomeWorker } from '../slack/home';

export interface AppContext {
  mongoStores: MongoStores;
  slackHome: ReturnType<typeof createSlackHomeWorker>;
}
