import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useResource } from "react-liwi";
import { SettingsHomeScreen } from "#/sections/settings/SettingsHomeScreen.tsx";
import { useAuthenticatedUser } from "#/services/AuthenticatedUserProvider.tsx";
import { useReviewflowServices } from "#/services/ReviewflowServicesProvider.tsx";

export default function SettingsPage(): ReactNode {
  const router = useRouter();
  const user = useAuthenticatedUser();
  const { orgsService } = useReviewflowServices();

  const orgs = useResource(
    orgsService.queries.queryMyOrgs,
    { subscribe: true },
    [],
  );

  return (
    <SettingsHomeScreen
      userLogin={user.login}
      orgs={orgs}
      onSelectUser={() => {
        router.navigate("/user");
      }}
      onSelectOrg={(org) => {
        router.navigate(`/org/${org.login}`);
      }}
    />
  );
}
