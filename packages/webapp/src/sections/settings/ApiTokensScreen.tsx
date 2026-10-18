import { View } from "alouette";
import type { ReactNode } from "react";
import type { ResourceResult } from "react-liwi";
import type {
  CreatedPersonalToken,
  OrgSummary,
  PersonalTokenSummary,
  UserSummary,
} from "reviewflow-modules";
import { ResourceView } from "#/components/resource-view.tsx";
import { Screen } from "#/components/screen.tsx";
import { SkeletonList } from "#/components/skeleton.tsx";
import { PersonalTokensList } from "./PersonalTokensList.tsx";
import { TokenReachList } from "./TokenReachList.tsx";

interface ApiTokensScreenProps {
  userLogin: string;
  me: ResourceResult<UserSummary | undefined, Record<string, never>>;
  personalTokens: ResourceResult<PersonalTokenSummary[], Record<string, never>>;
  orgs: ResourceResult<OrgSummary[], Record<string, never>>;
  onBack: () => void;
  onCreate: (name: string) => Promise<CreatedPersonalToken>;
  onRegenerate: (tokenId: string) => Promise<CreatedPersonalToken>;
  onRevoke: (tokenId: string) => Promise<void>;
}

export function ApiTokensScreen({
  userLogin,
  me,
  personalTokens,
  orgs,
  onBack,
  onCreate,
  onRegenerate,
  onRevoke,
}: ApiTokensScreenProps): ReactNode {
  return (
    <Screen title="API tokens" backLabel="Back to settings" onBack={onBack}>
      <ResourceView resource={me} loading={<SkeletonList rows={3} />}>
        {(user) => (
          <ResourceView resource={orgs} loading={<SkeletonList rows={3} />}>
            {(orgList) => {
              const userPaidEnabled = user?.paidEnabled ?? false;
              const canReadAnAccount =
                userPaidEnabled || orgList.some((org) => org.paidEnabled);

              return (
                <View className="gap-l">
                  <ResourceView resource={personalTokens}>
                    {(tokens) => (
                      <PersonalTokensList
                        tokens={tokens}
                        isApiEnabled={canReadAnAccount}
                        onCreate={onCreate}
                        onRegenerate={onRegenerate}
                        onRevoke={onRevoke}
                      />
                    )}
                  </ResourceView>
                  <TokenReachList
                    userLogin={userLogin}
                    userPaidEnabled={userPaidEnabled}
                    orgs={orgList}
                  />
                </View>
              );
            }}
          </ResourceView>
        )}
      </ResourceView>
    </Screen>
  );
}
