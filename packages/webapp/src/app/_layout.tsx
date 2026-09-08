import "../global.css";
import { AlouetteProvider } from "alouette";
import { Slot } from "expo-router";
import type { ReactNode } from "react";
import { ColorModeProvider } from "#/services/ColorModeProvider.tsx";
import { themeVariables } from "#/themeVariables.ts";

export default function RootLayout(): ReactNode {
  return (
    <AlouetteProvider themeVariables={themeVariables}>
      <ColorModeProvider>
        <Slot />
      </ColorModeProvider>
    </AlouetteProvider>
  );
}
