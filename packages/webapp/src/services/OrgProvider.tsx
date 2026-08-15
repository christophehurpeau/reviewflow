import type { ReactNode } from "react";
import { createContext, use } from "react";
import { useResource } from "react-liwi";
import type { OrgSummary } from "reviewflow-modules";
import { ResourceView } from "#/components/resource-view.tsx";
import { Screen } from "#/components/screen.tsx";
import { SkeletonSections } from "#/components/skeleton.tsx";
import { OrgNotFoundScreen } from "#/sections/org/OrgNotFoundScreen.tsx";
import { useReviewflowServices } from "./ReviewflowServicesProvider.tsx";

const OrgContext = createContext<OrgSummary | undefined>(undefined);

export const useOrg = (): OrgSummary => {
  const org = use(OrgContext);
  if (!org) throw new Error("Missing OrgProvider");
  return org;
};

interface OrgProviderProps {
  orgLogin: string;
  onOrgNotFound: () => void;
  children: ReactNode;
}

/**
 * Routes address an org by login, resources by id. Resolving it once for the
 * whole org section keeps every screen below free of the "id not known yet"
 * state, and shares one org list subscription instead of reopening it per
 * component that needs the id.
 */
export function OrgProvider({
  orgLogin,
  onOrgNotFound,
  children,
}: OrgProviderProps): ReactNode {
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
        <Screen title={orgLogin}>
          <SkeletonSections sections={3} />
        </Screen>
      }
    >
      {(orgList) => {
        const org = orgList.find((item) => item.login === orgLogin);
        if (!org) {
          return (
            <OrgNotFoundScreen orgLogin={orgLogin} onBack={onOrgNotFound} />
          );
        }
        return <OrgContext value={org}>{children}</OrgContext>;
      }}
    </ResourceView>
  );
}
