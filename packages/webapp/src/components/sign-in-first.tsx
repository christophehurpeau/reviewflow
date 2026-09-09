import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  currentPath,
  rememberSignInRedirect,
} from "#/services/signInRedirect.ts";

/**
 * Sends a signed out visitor to the landing page, keeping the path they asked
 * for aside so the oauth roundtrip can come back to it.
 */
export function SignInFirst(): ReactNode {
  // captured before the redirect below navigates away from it
  const [askedPath] = useState(currentPath);

  useEffect(() => {
    rememberSignInRedirect(askedPath);
  }, [askedPath]);

  return <Redirect href="/" />;
}
