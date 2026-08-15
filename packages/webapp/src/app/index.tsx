import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { useResource } from "react-liwi";
import { ResourceView } from "#/components/resource-view.tsx";
import { Screen } from "#/components/screen.tsx";
import { SkeletonSections } from "#/components/skeleton.tsx";
import { buildPrAccounts } from "#/sections/prs/prAccounts.ts";
import { useReviewflowServices } from "#/services/ReviewflowServicesProvider.tsx";

/**
 * Landing section: pull requests, unless reviewflow is installed nowhere yet
 * and the only thing left to do is install it from the settings.
 */
export default function HomePage(): ReactNode {
  const { orgsService, usersService } = useReviewflowServices();

  const me = useResource(usersService.queries.queryMe, { subscribe: true }, []);
  const orgs = useResource(
    orgsService.queries.queryMyOrgs,
    { subscribe: true },
    [],
  );

  return (
    <ResourceView
      resource={me}
      loading={
        <Screen title="reviewflow">
          <SkeletonSections sections={2} />
        </Screen>
      }
    >
      {(user) => (
        <ResourceView
          resource={orgs}
          loading={
            <Screen title="reviewflow">
              <SkeletonSections sections={2} />
            </Screen>
          }
        >
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
