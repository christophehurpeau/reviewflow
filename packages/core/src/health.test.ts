import { describe, expect, it, vi } from "vitest";
import { createHealthChecker, healthHttpStatus } from "./health.ts";
import type { MongoStores } from "./mongo.ts";

const createConnection = (command: () => Promise<unknown>) => {
  const dbCommand = vi.fn(command);
  const getConnection = vi.fn(() =>
    Promise.resolve({ db: () => ({ command: dbCommand }) }),
  );
  return {
    dbCommand,
    stores: { connection: { getConnection } } as unknown as MongoStores,
  };
};

describe("createHealthChecker", () => {
  it("is ok when mongo answers the ping", async () => {
    const { stores, dbCommand } = createConnection(() => Promise.resolve({}));

    const status = await createHealthChecker(stores).check();

    expect(status).toBe("ok");
    expect(dbCommand).toHaveBeenCalledWith({ ping: 1 });
  });

  it("is degraded when the ping fails", async () => {
    const { stores } = createConnection(() =>
      Promise.reject(new Error("mongo-secret-host:27017 refused")),
    );

    const status = await createHealthChecker(stores).check();

    expect(status).toBe("degraded");
  });

  it("is degraded when the ping does not answer in time", async () => {
    const { stores } = createConnection(
      () =>
        new Promise(() => {
          /* never settles */
        }),
    );

    const status = await createHealthChecker(stores, {
      pingTimeoutMs: 10,
    }).check();

    expect(status).toBe("degraded");
  });

  it("shares one ping between concurrent calls and caches the answer", async () => {
    let time = 1000;
    const { stores, dbCommand } = createConnection(() => Promise.resolve({}));
    const checker = createHealthChecker(stores, {
      cacheMs: 5000,
      now: () => time,
    });

    await Promise.all([checker.check(), checker.check(), checker.check()]);
    time += 4000;
    await checker.check();
    expect(dbCommand).toHaveBeenCalledTimes(1);

    time += 1001;
    await checker.check();
    expect(dbCommand).toHaveBeenCalledTimes(2);
  });
});

describe("healthHttpStatus", () => {
  it("is 200 when ok and 503 when degraded", () => {
    expect(healthHttpStatus("ok")).toBe(200);
    expect(healthHttpStatus("degraded")).toBe(503);
  });
});
