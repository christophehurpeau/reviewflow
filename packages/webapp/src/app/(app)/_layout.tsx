import { ConnectionState } from "alouette";
import { Slot } from "expo-router";
import { createVoidTransportClient } from "liwi-resources-void-client";
import type { WebsocketTransportClientOptions } from "liwi-resources-websocket-client";
import { createWebsocketTransportClient } from "liwi-resources-websocket-client";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  TransportClientProvider,
  transportClientStateToSimplifiedState,
  useTransportClientState,
} from "react-liwi";
import {
  AuthenticatedUserProvider,
  useAuthenticatedUserOrNull,
} from "#/services/AuthenticatedUserProvider.tsx";
import { ReviewflowServicesProvider } from "#/services/ReviewflowServicesProvider.tsx";
import { websocketUrl } from "#/services/serverUrl.ts";

const isServerRendering = globalThis.window === undefined;

/** Leaving the page closes the socket, which is not a connection loss. */
function useIsLeavingPage(): boolean {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // react native has no page lifecycle events
    if (!("addEventListener" in globalThis)) return undefined;
    const handlePageHide = (): void => {
      setIsLeaving(true);
    };
    globalThis.addEventListener("pagehide", handlePageHide);
    return () => {
      globalThis.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  return isLeaving;
}

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
function AppConnectionState(): ReactNode {
  const user = useAuthenticatedUserOrNull();
  if (!user) return null;
  return <SignedInConnectionState />;
}

/**
 * Everything the app needs to talk to the server. Routes outside this group,
 * `/storybook`, render components in isolation and have no server to ask.
 */
export default function AppLayout(): ReactNode {
  return (
    <TransportClientProvider<WebsocketTransportClientOptions>
      url={isServerRendering ? undefined : websocketUrl()}
      createFn={
        isServerRendering
          ? createVoidTransportClient
          : createWebsocketTransportClient
      }
      onError={console.error}
    >
      <ReviewflowServicesProvider>
        <AuthenticatedUserProvider>
          <AppConnectionState />
          <Slot />
        </AuthenticatedUserProvider>
      </ReviewflowServicesProvider>
    </TransportClientProvider>
  );
}
