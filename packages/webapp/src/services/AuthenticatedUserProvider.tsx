import { Button, ErrorMessage, VStack } from "alouette";
import { ResourcesServerError } from "liwi-resources-client";
import type { ReactNode } from "react";
import { createContext, use, useEffect, useMemo, useState } from "react";
import { useTransportClientIsReady } from "react-liwi";
import type { AuthenticatedUser } from "reviewflow-modules";
import { SkeletonSections } from "#/components/skeleton.tsx";
import { errorToMessage } from "#/errorToMessage.ts";
import { useReviewflowServices } from "./ReviewflowServicesProvider.tsx";

interface AuthenticatedUserContextValue {
  user: AuthenticatedUser | null;
}

const AuthenticatedUserContext = createContext<
  AuthenticatedUserContextValue | undefined
>(undefined);

/** `null` while signed out, which only the landing page is allowed to render. */
export const useAuthenticatedUserOrNull = (): AuthenticatedUser | null => {
  const contextValue = use(AuthenticatedUserContext);
  if (!contextValue) throw new Error("Missing AuthenticatedUserProvider");
  return contextValue.user;
};

export const useAuthenticatedUser = (): AuthenticatedUser => {
  const user = useAuthenticatedUserOrNull();
  if (!user) throw new Error("Not authenticated");
  return user;
};

interface AuthenticatedUserProviderProps {
  children: ReactNode;
}

/**
 * Every resource is scoped to the session cookie, which the app cannot read.
 * Asking the server who we are is therefore both the identity lookup and the
 * logged-out check.
 */
export function AuthenticatedUserProvider({
  children,
}: AuthenticatedUserProviderProps): ReactNode {
  const { usersService } = useReviewflowServices();
  const isReady = useTransportClientIsReady();
  const [user, setUser] = useState<AuthenticatedUser | null>();
  const [error, setError] = useState<unknown>();
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!isReady || user !== undefined) return;

    let cancelled = false;
    usersService.operations.getAuthenticatedUser().then(
      (authenticatedUser) => {
        if (!cancelled) setUser(authenticatedUser);
      },
      (error: unknown) => {
        if (
          error instanceof ResourcesServerError &&
          error.code === "UNAUTHENTICATED"
        ) {
          if (!cancelled) setUser(null);
          return;
        }
        // nothing retries this lookup on its own, and the whole app is gated
        // behind it: a swallowed error leaves the skeleton up forever
        if (!cancelled) setError(error);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [isReady, user, usersService, retryCount]);

  const contextValue = useMemo(
    () => (user === undefined ? undefined : { user }),
    [user],
  );

  if (!contextValue) {
    return (
      <VStack className="min-h-screen bg-screen">
        <VStack className="mx-auto w-full max-w-[960px] gap-l p-l">
          {error ? (
            <>
              <ErrorMessage>{errorToMessage(error)}</ErrorMessage>
              <Button
                variant="outlined"
                text="Retry"
                onPress={() => {
                  setError(undefined);
                  setRetryCount((count) => count + 1);
                }}
              />
            </>
          ) : (
            <SkeletonSections sections={2} />
          )}
        </VStack>
      </VStack>
    );
  }

  return (
    <AuthenticatedUserContext value={contextValue}>
      {children}
    </AuthenticatedUserContext>
  );
}
