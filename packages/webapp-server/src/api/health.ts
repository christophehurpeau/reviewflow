import type { MongoStores } from "reviewflow-core";

export interface Health {
  status: "degraded" | "ok";
  /**
   * `unknown` until the change stream consumer reports it (L29), which adds
   * `ok` and `lagging`: a client treats any other value as unknown
   */
  propagation: "lagging" | "ok" | "unknown";
  /** `null` while `propagation` is `unknown` */
  lagSeconds: number | null;
}

export interface HealthChecker {
  check: () => Promise<Health>;
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
 * Unauthenticated, so what it costs is bounded here: one ping at a time, its
 * answer shared for `cacheMs`, instead of a per-caller limit.
 */
export const createHealthChecker = (
  mongoStores: Pick<MongoStores, "connection">,
  {
    pingTimeoutMs = 2000,
    cacheMs = 5000,
    now = Date.now,
  }: HealthCheckerOptions = {},
): HealthChecker => {
  let cached: { at: number; health: Health } | undefined;
  let inFlight: Promise<Health> | undefined;

  const measure = async (): Promise<Health> => {
    const up = await pingMongo(mongoStores, pingTimeoutMs);
    const health: Health = {
      status: up ? "ok" : "degraded",
      propagation: "unknown",
      lagSeconds: null,
    };
    cached = { at: now(), health };
    return health;
  };

  return {
    check: async () => {
      if (cached && now() - cached.at < cacheMs) return cached.health;
      inFlight ??= measure().finally(() => {
        inFlight = undefined;
      });
      return inFlight;
    },
  };
};
