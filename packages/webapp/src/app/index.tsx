import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { useResource } from "react-liwi";
import { ResourceView } from "#/components/resource-view.tsx";
import { Screen } from "#/components/screen.tsx";
import { SkeletonSections } from "#/components/skeleton.tsx";
import { useReviewflowServices } from "#/services/ReviewflowServicesProvider.tsx";

/**
 * Landing section: pull requests, unless reviewflow is on no organization yet
 * and the only thing left to do is install it from the settings.
 */
export default function HomePage(): ReactNode {
  const { orgsService } = useReviewflowServices();

  const orgs = useResource(
    orgsService.queries.queryMyOrgs,
    { subscribe: true },
    [],
  );

  return (
    <ResourceView
      resource={orgs}
      loading={
        <Screen title="reviewflow">
          <SkeletonSections sections={2} />
        </Screen>
      }
    >
      {(orgList) => (
        <Redirect href={orgList.length === 0 ? "/settings" : "/prs"} />
      )}
    </ResourceView>
  );
}
