import { Redirect, Slot } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AppShell } from "#/components/app-shell.tsx";
import { useAuthenticatedUserOrNull } from "#/services/AuthenticatedUserProvider.tsx";
import {
  currentPath,
  rememberSignInRedirect,
} from "#/services/signInRedirect.ts";

function SignInFirst(): ReactNode {
  // captured before the redirect below navigates away from it
  const [askedPath] = useState(currentPath);

  useEffect(() => {
    rememberSignInRedirect(askedPath);
  }, [askedPath]);

  return <Redirect href="/" />;
}

/** Every screen below reads the signed in user: signing in comes first. */
export default function AuthenticatedLayout(): ReactNode {
  const user = useAuthenticatedUserOrNull();

  if (!user) return <SignInFirst />;

  return (
    <AppShell>
      <Slot />
    </AppShell>
  );
}
