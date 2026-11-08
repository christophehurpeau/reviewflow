import "../global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AlouetteProvider, View } from "alouette";
import { Slot } from "expo-router";
import type { ReactNode } from "react";
import { AppHeader } from "#/services/AppHeader.tsx";
import { ColorModeProvider } from "#/services/ColorModeProvider.tsx";
import { DensityProvider } from "#/services/DensityProvider.tsx";
import { LiveEvents } from "#/services/liveEvents.tsx";
import { themeVariables } from "#/themeVariables.ts";

// a failure is shown by the screen as it happens, not retried behind its back
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

export default function RootLayout(): ReactNode {
  return (
    <AlouetteProvider themeVariables={themeVariables}>
      <ColorModeProvider>
        <DensityProvider>
          <QueryClientProvider client={queryClient}>
            <LiveEvents />
            <View className="min-h-0 flex-1 bg-screen">
              <AppHeader />
              <View className="min-h-0 flex-1">
                <Slot />
              </View>
            </View>
          </QueryClientProvider>
        </DensityProvider>
      </ColorModeProvider>
    </AlouetteProvider>
  );
}
