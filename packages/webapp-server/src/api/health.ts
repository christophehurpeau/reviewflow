import type { HealthStatus } from "reviewflow-core";
import { STORE_RELAY_HEARTBEAT_INTERVAL_MS } from "reviewflow-core";

export interface HealthV1 {
  status: HealthStatus;
  /**
   * `lagging` when the relay from the bot is down or silent: the webapp then
   * stops updating live. A client treats any other value as unknown
   */
  propagation: "lagging" | "ok";
  /** seconds since the last message of the relay, `null` before the first */
  lagSeconds: number | null;
}

export interface RelayState {
  isLive: boolean;
  lastMessageAt: Date | null;
}

export type GetRelayState = () => RelayState;

/** two missed heartbeats: one alone can be late */
const MAX_SILENCE_MS = 2 * STORE_RELAY_HEARTBEAT_INTERVAL_MS;

export const toHealthV1 = (
  status: HealthStatus,
  { isLive, lastMessageAt }: RelayState,
  now = Date.now(),
): HealthV1 => {
  const silenceMs = lastMessageAt
    ? Math.max(0, now - lastMessageAt.getTime())
    : null;
  const lagging = !isLive || silenceMs === null || silenceMs >= MAX_SILENCE_MS;
  return {
    status: lagging ? "degraded" : status,
    propagation: lagging ? "lagging" : "ok",
    lagSeconds: silenceMs === null ? null : Math.floor(silenceMs / 1000),
  };
};
