import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useResource } from "react-liwi";
import { AdminScreen } from "#/sections/admin/AdminScreen.tsx";
import { useAuthenticatedUser } from "#/services/AuthenticatedUserProvider.tsx";
import { useReviewflowServices } from "#/services/ReviewflowServicesProvider.tsx";

export default function AdminPage(): ReactNode {
  const router = useRouter();
  const user = useAuthenticatedUser();
  const { adminService } = useReviewflowServices();
  const skip = !user.isAdmin;

  const orgs = useResource(
    adminService.queries.queryAdminOrgs,
    { subscribe: true, skip },
    [skip],
  );
  const users = useResource(
    adminService.queries.queryAdminUsers,
    { subscribe: true, skip },
    [skip],
  );

  return (
    <AdminScreen
      isAdmin={user.isAdmin}
      orgs={orgs}
      users={users}
      onBack={() => {
        router.navigate("/settings");
      }}
      onSetEnabled={(account, enabled) =>
        adminService.operations.setAccountPaidEnabled({
          accountId: account._id,
          accountType: account.type,
          enabled,
        })
      }
    />
  );
}
