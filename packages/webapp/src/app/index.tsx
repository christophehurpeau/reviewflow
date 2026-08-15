import { Redirect, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { useResource } from "react-liwi";
import { AppShell } from "#/components/app-shell.tsx";
import { ResourceView } from "#/components/resource-view.tsx";
import { Screen } from "#/components/screen.tsx";
import { SkeletonSections } from "#/components/skeleton.tsx";
import { LandingScreen } from "#/sections/landing/LandingScreen.tsx";
import { buildPrAccounts } from "#/sections/prs/prAccounts.ts";
import { useAuthenticatedUserOrNull } from "#/services/AuthenticatedUserProvider.tsx";
import { useReviewflowServices } from "#/services/ReviewflowServicesProvider.tsx";
import { goToLogin } from "#/services/serverUrl.ts";
import { takeSignInRedirect } from "#/services/signInRedirect.ts";

const redirectingScreen = (
  <AppShell>
    <Screen title="reviewflow">
      <SkeletonSections sections={2} />
    </Screen>
  </AppShell>
);

/**
 * Landing section: pull requests, unless reviewflow is installed nowhere yet
 * and the only thing left to do is install it from the settings.
 */
function SignedInRedirect(): ReactNode {
  const { orgsService, usersService } = useReviewflowServices();
  // where signing in was asked from, the oauth flow always coming back here
  const [askedPath] = useState(takeSignInRedirect);

  const me = useResource(usersService.queries.queryMe, { subscribe: true }, []);
  const orgs = useResource(
    orgsService.queries.queryMyOrgs,
    { subscribe: true },
    [],
  );

  if (askedPath) return <Redirect href={askedPath} />;

  return (
    <ResourceView resource={me} loading={redirectingScreen}>
      {(user) => (
        <ResourceView resource={orgs} loading={redirectingScreen}>
          {(orgList) => (
            <Redirect
              href={
                buildPrAccounts(user, orgList).length === 0
                  ? "/settings"
                  : "/prs"
              }
            />
          )}
        </ResourceView>
      )}
    </ResourceView>
  );
}

/**
 * The only route a signed out visitor may render: the oauth routes send their
 * outcome back here, as `error` and `loggedOut` query parameters.
 */
export default function HomePage(): ReactNode {
  const user = useAuthenticatedUserOrNull();
  const { error, loggedOut } = useLocalSearchParams<{
    error?: string;
    loggedOut?: string;
  }>();

  if (user) return <SignedInRedirect />;

  return (
    <LandingScreen
      error={error}
      loggedOut={loggedOut === "1"}
      onSignIn={goToLogin}
    />
  );
}
