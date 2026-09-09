import { AppShellMain } from "alouette";
import { Slot } from "expo-router";
import type { ReactNode } from "react";
import { ReviewflowShell } from "#/components/app-shell.tsx";
import { SignInFirst } from "#/components/sign-in-first.tsx";
import { useAuthenticatedUserOrNull } from "#/services/AuthenticatedUserProvider.tsx";

/** Every screen below reads the signed in user: signing in comes first. */
export default function AuthenticatedLayout(): ReactNode {
  const user = useAuthenticatedUserOrNull();

  if (!user) return <SignInFirst />;

  return (
    <ReviewflowShell>
      <AppShellMain>
        <Slot />
      </AppShellMain>
    </ReviewflowShell>
  );
}
