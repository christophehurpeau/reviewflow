import { Slot } from "expo-router";
import type { ReactNode } from "react";
import { SignInFirst } from "#/components/sign-in-first.tsx";
import { useAuthenticatedUserOrNull } from "#/services/AuthenticatedUserProvider.tsx";

/**
 * Signed in, but without the application shell: for a screen nobody navigates
 * to on purpose and nobody stays on — it acts and forwards elsewhere, so a
 * header and a nav would only offer somewhere else to go.
 */
export default function AuthenticatedBareLayout(): ReactNode {
  const user = useAuthenticatedUserOrNull();

  if (!user) return <SignInFirst />;

  return <Slot />;
}
