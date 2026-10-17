import type { HealthStatus } from "reviewflow-core";

export interface HealthV1 {
  status: HealthStatus;
  /**
   * `unknown` until the change stream consumer reports it (L29), which adds
   * `ok` and `lagging`: a client treats any other value as unknown
   */
  propagation: "lagging" | "ok" | "unknown";
  /** `null` while `propagation` is `unknown` */
  lagSeconds: number | null;
}

export const toHealthV1 = (status: HealthStatus): HealthV1 => ({
  status,
  propagation: "unknown",
  lagSeconds: null,
});
