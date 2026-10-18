import type { HealthStatus } from "reviewflow-core";
import { STORE_RELAY_HEARTBEAT_INTERVAL_MS } from "reviewflow-core";

export interface HealthV1 {
  status: HealthStatus;
  /**
   * `lagging` when the relay from the bot is down or silent: the webapp then
   * stops updating live. `disabled` when switched off on purpose. A client
   * treats any other value as unknown
   */
  propagation: "disabled" | "lagging" | "ok";
  /** seconds since the last message of the relay, `null` before the first */
  lagSeconds: number | null;
}

export interface RelayState {
  isLive: boolean;
  lastMessageAt: Date | null;
}

/** undefined when the relay is disabled (`STORE_RELAY_DISABLED`) */
export type GetRelayState = () => RelayState | undefined;

/** two missed heartbeats: one alone can be late */
const MAX_SILENCE_MS = 2 * STORE_RELAY_HEARTBEAT_INTERVAL_MS;

export const toHealthV1 = (
  status: HealthStatus,
  relayState: RelayState | undefined,
  now = Date.now(),
): HealthV1 => {
  if (!relayState) return { status, propagation: "disabled", lagSeconds: null };
  const { isLive, lastMessageAt } = relayState;
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
