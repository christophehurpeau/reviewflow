import { InfoMessage, View } from "alouette";
import type { ReactNode } from "react";
import type { ResourceResult } from "react-liwi";
import type { AdminAccountSummary } from "reviewflow-modules";
import { ResourceView } from "#/components/resource-view.tsx";
import { Screen } from "#/components/screen.tsx";
import { SkeletonSections } from "#/components/skeleton.tsx";
import { AdminAccountsList } from "./AdminAccountsList.tsx";

type AdminAccountsResource = ResourceResult<
  AdminAccountSummary[],
  Record<string, never>
>;

interface AdminScreenProps {
  isAdmin: boolean;
  orgs: AdminAccountsResource;
  users: AdminAccountsResource;
  onBack: () => void;
  onSetEnabled: (
    account: AdminAccountSummary,
    enabled: boolean,
  ) => Promise<void>;
}

export function AdminScreen({
  isAdmin,
  orgs,
  users,
  onBack,
  onSetEnabled,
}: AdminScreenProps): ReactNode {
  return (
    <Screen title="Admin" backLabel="Back to settings" onBack={onBack}>
      {isAdmin ? (
        <View className="gap-l">
          <InfoMessage>
            Enabling an account gives it the paid features: live updates in the
            webapp and the read API.
          </InfoMessage>
          <ResourceView
            resource={orgs}
            loading={<SkeletonSections sections={1} />}
          >
            {(orgList) => (
              <AdminAccountsList
                title="Organizations"
                accounts={orgList}
                onSetEnabled={onSetEnabled}
              />
            )}
          </ResourceView>
          <ResourceView
            resource={users}
            loading={<SkeletonSections sections={1} />}
          >
            {(userList) => (
              <AdminAccountsList
                title="Personal accounts"
                accounts={userList}
                onSetEnabled={onSetEnabled}
              />
            )}
          </ResourceView>
        </View>
      ) : (
        <InfoMessage>This page is reserved to the instance admin.</InfoMessage>
      )}
    </Screen>
  );
}
