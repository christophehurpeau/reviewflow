import { Badge } from "alouette";
import type { ReactNode } from "react";
import { useLiveState } from "./liveEvents.tsx";

const labels = {
  connecting: { text: "connecting", accent: "warning" },
  live: { text: "live", accent: "success" },
  reconnecting: { text: "reconnecting", accent: "warning" },
  stopped: { text: "offline", accent: undefined },
  unavailable: { text: "no live updates", accent: undefined },
} as const;

/** Whether this page's event connection to the app server is up. */
export function LiveIndicator(): ReactNode {
  const { text, accent } = labels[useLiveState()];
  return (
    <Badge accent={accent} variant="outlined">
      {text}
    </Badge>
  );
}
