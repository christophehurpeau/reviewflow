import "../global.css";
import {
  AlouetteProvider,
  ConnectionState,
  ScrollView,
  VStack,
} from "alouette";
import { themeVariables } from "alouette/defaultThemeVariables";
import { Slot } from "expo-router";
import { createVoidTransportClient } from "liwi-resources-void-client";
import type { WebsocketTransportClientOptions } from "liwi-resources-websocket-client";
import { createWebsocketTransportClient } from "liwi-resources-websocket-client";
import type { ReactNode } from "react";
import {
  TransportClientProvider,
  transportClientStateToSimplifiedState,
  useTransportClientState,
} from "react-liwi";
import { AppHeader } from "#/components/app-header.tsx";
import { AuthenticatedUserProvider } from "#/services/AuthenticatedUserProvider.tsx";
import { ReviewflowServicesProvider } from "#/services/ReviewflowServicesProvider.tsx";
import { websocketUrl } from "#/services/serverUrl.ts";

const isServerRendering = globalThis.window === undefined;

function AppConnectionState(): ReactNode {
  const state = transportClientStateToSimplifiedState(
    useTransportClientState(),
  );
  return (
    <ConnectionState state={state}>
      {state === "connected" ? "Connected" : "Reconnecting…"}
    </ConnectionState>
  );
}

export default function RootLayout(): ReactNode {
  return (
    <AlouetteProvider themeVariables={themeVariables}>
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
          <AppConnectionState />
          <AuthenticatedUserProvider>
            <VStack className="h-screen bg-screen">
              <ScrollView className="flex-1" contentContainerClassName="pb-xl">
                <AppHeader />
                <Slot />
              </ScrollView>
            </VStack>
          </AuthenticatedUserProvider>
        </ReviewflowServicesProvider>
      </TransportClientProvider>
    </AlouetteProvider>
  );
}
