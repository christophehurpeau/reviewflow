import { Button, ErrorMessage, VStack } from "alouette";
import { ResourcesServerError } from "liwi-resources-client";
import type { ReactNode } from "react";
import { createContext, use, useEffect, useState } from "react";
import { useTransportClientIsReady } from "react-liwi";
import type { AuthenticatedUser } from "reviewflow-modules";
import { SkeletonSections } from "#/components/skeleton.tsx";
import { errorToMessage } from "#/errorToMessage.ts";
import { useReviewflowServices } from "./ReviewflowServicesProvider.tsx";
import { goToLogin } from "./serverUrl.ts";

const AuthenticatedUserContext = createContext<AuthenticatedUser | undefined>(
  undefined,
);

export const useAuthenticatedUser = (): AuthenticatedUser => {
  const user = use(AuthenticatedUserContext);
  if (!user) throw new Error("Missing AuthenticatedUserProvider");
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
  const [user, setUser] = useState<AuthenticatedUser>();
  const [error, setError] = useState<unknown>();
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!isReady || user) return;

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
          goToLogin();
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

  if (!user) {
    return (
      <VStack className="min-h-screen bg-screen">
        <VStack className="mx-auto w-full max-w-[960px] gap-l p-lg">
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
    <AuthenticatedUserContext value={user}>{children}</AuthenticatedUserContext>
  );
}
