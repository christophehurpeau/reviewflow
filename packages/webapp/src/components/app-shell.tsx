import { ScrollView, VStack } from "alouette";
import type { ReactNode } from "react";
import { AppHeader } from "#/components/app-header.tsx";

interface AppShellProps {
  children: ReactNode;
}

/** Signed in chrome: the header and the scrolling area every screen sits in. */
export function AppShell({ children }: AppShellProps): ReactNode {
  return (
    <VStack className="h-screen bg-screen">
      <ScrollView className="flex-1" contentContainerClassName="pb-xl">
        <AppHeader />
        {children}
      </ScrollView>
    </VStack>
  );
}
