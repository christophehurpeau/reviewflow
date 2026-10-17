import type { MongoStores } from "./mongo.ts";

export type HealthStatus = "degraded" | "ok";

export interface HealthChecker {
  check: () => Promise<HealthStatus>;
}

export interface HealthCheckerOptions {
  /** a ping slower than this counts as down */
  pingTimeoutMs?: number;
  /** the last answer is reused for this long, whoever asks */
  cacheMs?: number;
  now?: () => number;
}

const pingMongo = async (
  { connection }: Pick<MongoStores, "connection">,
  timeoutMs: number,
): Promise<boolean> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => {
      resolve(false);
    }, timeoutMs);
    timer.unref();
  });
  const ping = connection
    .getConnection()
    .then((client) => client.db("admin").command({ ping: 1 }))
    .then(
      () => true as const,
      () => false as const,
    );

  try {
    return await Promise.race([ping, timeout]);
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Served unauthenticated, so what it costs is bounded here: one ping at a
 * time, its answer shared for `cacheMs`, instead of a per-caller limit.
 */
export const createHealthChecker = (
  mongoStores: Pick<MongoStores, "connection">,
  {
    pingTimeoutMs = 2000,
    cacheMs = 5000,
    now = Date.now,
  }: HealthCheckerOptions = {},
): HealthChecker => {
  let cached: { at: number; status: HealthStatus } | undefined;
  let inFlight: Promise<HealthStatus> | undefined;

  const measure = async (): Promise<HealthStatus> => {
    const up = await pingMongo(mongoStores, pingTimeoutMs);
    const status: HealthStatus = up ? "ok" : "degraded";
    cached = { at: now(), status };
    return status;
  };

  return {
    check: async () => {
      if (cached && now() - cached.at < cacheMs) return cached.status;
      inFlight ??= measure().finally(() => {
        inFlight = undefined;
      });
      return inFlight;
    },
  };
};

export const healthHttpStatus = (status: HealthStatus): 200 | 503 =>
  status === "ok" ? 200 : 503;
