import { MongoMemoryServer } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

// same augmentation as packages/core/src/tests/testMongoStores.ts, each file is
// typechecked by its own tsconfig
declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

// one per project listing this file, all stopped together
const servers: MongoMemoryServer[] = [];

// one standalone mongod per vitest run (prod is standalone), shared by the
// projects that list this file in `globalSetup`; each test file takes its own db
export async function setup(project: TestProject): Promise<void> {
  const mongod = await MongoMemoryServer.create({
    // the binary is downloaded on first use then cached (~/.cache/mongodb-binaries)
    binary: { version: process.env.MONGOMS_VERSION || "7.0.37" },
  });
  servers.push(mongod);
  project.provide("mongoUri", mongod.getUri());
}

export async function teardown(): Promise<void> {
  await Promise.all(servers.splice(0).map((server) => server.stop()));
}
