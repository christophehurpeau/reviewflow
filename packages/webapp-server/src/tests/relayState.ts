import type { RelayState } from "../api/health.ts";

export const liveRelayState = (): RelayState => ({
  isLive: true,
  lastMessageAt: new Date(),
});
