import { randomUUID } from "node:crypto";
import type { MongoConnection } from "liwi-mongo";
import { inject } from "vitest";
import init from "../mongo.ts";
import type { MongoStores } from "../mongo.ts";

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

// the `mongodb` version liwi-mongo ships, not necessarily the root one
type Db = ReturnType<
  Awaited<ReturnType<MongoConnection["getConnection"]>>["db"]
>;

export interface TestMongoStores extends MongoStores {
  /** raw database: the subscribe stores do not expose their collection */
  db: Db;
  /** drops the database and closes the connection */
  dispose: () => Promise<void>;
}

/**
 * Real stores over the mongod started by `scripts/vitestMongoGlobalSetup.ts`,
 * on a database of their own. Call `dispose` in `afterAll`.
 */
export async function createTestMongoStores(): Promise<TestMongoStores> {
  const url = new URL(inject("mongoUri"));
  const database = `test_${randomUUID().replaceAll("-", "")}`;

  // `init` reads its connection settings from the environment
  process.env.MONGO_HOST = url.hostname;
  process.env.MONGO_PORT = url.port;
  process.env.MONGO_DB = database;
  delete process.env.MONGO_USER;
  delete process.env.MONGO_PASSWORD;

  const stores = init();
  await stores.ready;
  const client = await stores.connection.getConnection();
  const db = client.db(database);

  return {
    ...stores,
    db,
    dispose: async () => {
      await db.dropDatabase();
      await stores.connection.close();
    },
  };
}
