import { View } from "alouette";
import type { ReactNode } from "react";
import type { ResourceResult } from "react-liwi";
import type {
  CreatedPersonalToken,
  OrgSummary,
  PersonalTokenSummary,
} from "reviewflow-modules";
import { ResourceView } from "#/components/resource-view.tsx";
import { Screen } from "#/components/screen.tsx";
import { SkeletonList } from "#/components/skeleton.tsx";
import { PersonalTokensList } from "./PersonalTokensList.tsx";
import { TokenReachList } from "./TokenReachList.tsx";

interface ApiTokensScreenProps {
  userLogin: string;
  personalTokens: ResourceResult<PersonalTokenSummary[], Record<string, never>>;
  orgs: ResourceResult<OrgSummary[], Record<string, never>>;
  onBack: () => void;
  onCreate: (name: string) => Promise<CreatedPersonalToken>;
  onRegenerate: (tokenId: string) => Promise<CreatedPersonalToken>;
  onRevoke: (tokenId: string) => Promise<void>;
}

export function ApiTokensScreen({
  userLogin,
  personalTokens,
  orgs,
  onBack,
  onCreate,
  onRegenerate,
  onRevoke,
}: ApiTokensScreenProps): ReactNode {
  return (
    <Screen title="API tokens" backLabel="Back to settings" onBack={onBack}>
      <View className="gap-l">
        <ResourceView resource={personalTokens}>
          {(tokens) => (
            <PersonalTokensList
              tokens={tokens}
              onCreate={onCreate}
              onRegenerate={onRegenerate}
              onRevoke={onRevoke}
            />
          )}
        </ResourceView>
        <ResourceView resource={orgs} loading={<SkeletonList rows={2} />}>
          {(orgList) => <TokenReachList userLogin={userLogin} orgs={orgList} />}
        </ResourceView>
      </View>
    </Screen>
  );
}
