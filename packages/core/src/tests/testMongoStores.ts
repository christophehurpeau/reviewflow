import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { MongoConnection } from "liwi-mongo";
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
 * `init` creates indexes and runs cleanups without awaiting them, and a
 * cleanup on a collection that does not exist yet rejects unhandled. Create
 * that collection first, then wait for the index count to stop moving so
 * nothing is in flight when a test starts or the connection closes.
 */
async function waitForBackgroundIndexes(db: Db): Promise<void> {
  const countIndexes = async (): Promise<number> => {
    const collections = await db.listCollections().toArray();
    let total = 0;
    for (const { name } of collections) {
      const indexes = await db.collection(name).indexes();
      total += indexes.length;
    }
    return total;
  };

  // stable over several reads: the chains in `init` (index, then cleanup)
  // leave gaps between two operations
  let previous = -1;
  let stableReads = 0;
  for (let attempt = 0; attempt < 100; attempt++) {
    const current = await countIndexes();
    stableReads = current === previous ? stableReads + 1 : 0;
    if (stableReads >= 3) return;
    previous = current;
    await setTimeout(100);
  }
  throw new Error("mongo indexes still being created after 10s");
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

  // `init` lists the indexes of this collection, which rejects when missing
  const setupConnection = new MongoConnection({
    host: url.hostname,
    port: url.port,
    database,
  });
  const setupClient = await setupConnection.getConnection();
  await setupClient.db(database).createCollection("slackSentMessages");
  await setupConnection.close();

  const stores = init();
  const client = await stores.connection.getConnection();
  const db = client.db(database);
  await waitForBackgroundIndexes(db);

  return {
    ...stores,
    db,
    dispose: async () => {
      await db.dropDatabase();
      await stores.connection.close();
    },
  };
}
