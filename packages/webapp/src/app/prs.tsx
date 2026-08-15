import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useResource } from "react-liwi";
import { PrsScreen } from "#/sections/prs/PrsScreen.tsx";
import { useReviewflowServices } from "#/services/ReviewflowServicesProvider.tsx";
import { useMyPrsByBucket } from "#/services/useMyPrsByBucket.ts";

const openPr = (url: string): void => {
  globalThis.open(url, "_blank", "noopener");
};

export default function PrsPage(): ReactNode {
  const router = useRouter();
  const { org: orgLogin } = useLocalSearchParams<{ org?: string }>();
  const { orgsService } = useReviewflowServices();

  const orgs = useResource(
    orgsService.queries.queryMyOrgs,
    { subscribe: true },
    [],
  );

  // the filter is a login, the query needs an id: an unknown login is dropped
  // rather than kept pending, so a stale link still shows something.
  const selectedOrg = orgs.fetched
    ? orgs.data.find((org) => org.login === orgLogin)
    : undefined;
  const pending = orgLogin !== undefined && !orgs.fetched;

  const prsByBucket = useMyPrsByBucket({
    orgId: selectedOrg?._id ?? null,
    skip: pending,
  });

  return (
    <PrsScreen
      orgs={orgs}
      selectedOrgLogin={selectedOrg?.login}
      prsByBucket={prsByBucket}
      pending={pending}
      onSelectOrgLogin={(login) => {
        router.replace(
          login ? { pathname: "/prs", params: { org: login } } : "/prs",
        );
      }}
      onSelectPr={(pr) => {
        openPr(pr.url);
      }}
    />
  );
}
