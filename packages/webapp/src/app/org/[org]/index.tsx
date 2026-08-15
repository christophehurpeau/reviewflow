import type { ReactNode } from "react";
import { useResource } from "react-liwi";
import { OrgSettingsScreen } from "#/sections/org/OrgSettingsScreen.tsx";
import { useOrg } from "#/services/OrgProvider.tsx";
import { useReviewflowServices } from "#/services/ReviewflowServicesProvider.tsx";

export default function OrgSettingsPage(): ReactNode {
  const org = useOrg();
  const { orgsService } = useReviewflowServices();

  const settings = useResource(
    orgsService.queries.queryOrgSettings,
    { params: { orgLogin: org.login }, subscribe: true },
    [org.login],
  );
  const dmSettings = useResource(
    orgsService.queries.queryMyDmSettings,
    { params: { orgId: org._id }, subscribe: true },
    [org._id],
  );

  return (
    <OrgSettingsScreen
      orgLogin={org.login}
      settings={settings}
      dmSettings={dmSettings}
      onForceSync={() => orgsService.operations.forceSync({ orgId: org._id })}
    />
  );
}
