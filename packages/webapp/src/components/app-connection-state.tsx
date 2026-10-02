import { ConnectionState } from "alouette";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  transportClientStateToSimplifiedState,
  useTransportClientState,
} from "react-liwi";
import { useAuthenticatedUserOrNull } from "#/services/AuthenticatedUserProvider.tsx";
import { useIsLeavingPage } from "#/services/useIsLeavingPage.ts";

/**
 * Mounted once the signed in user is known, so the socket has connected
 * already: only a later drop is worth surfacing.
 */
function SignedInConnectionState(): ReactNode {
  const state = transportClientStateToSimplifiedState(
    useTransportClientState(),
  );
  const isLeaving = useIsLeavingPage();
  const [hasDropped, setHasDropped] = useState(false);

  if (!hasDropped && state !== "connected") setHasDropped(true);

  return (
    <ConnectionState state={hasDropped ? state : null} forceHidden={isLeaving}>
      {state === "connected" ? "Connected" : "Reconnecting…"}
    </ConnectionState>
  );
}

/** The landing page reads nothing live: a signed out visitor gets no banner. */
export function AppConnectionState(): ReactNode {
  const user = useAuthenticatedUserOrNull();
  if (!user) return null;
  return <SignedInConnectionState />;
}
