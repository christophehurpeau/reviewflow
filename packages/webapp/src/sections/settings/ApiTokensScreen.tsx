import type { ReactNode } from "react";
import type { ResourceResult } from "react-liwi";
import type {
  CreatedPersonalToken,
  PersonalTokenSummary,
} from "reviewflow-modules";
import { ResourceView } from "#/components/resource-view.tsx";
import { Screen } from "#/components/screen.tsx";
import { PersonalTokensList } from "./PersonalTokensList.tsx";

interface ApiTokensScreenProps {
  personalTokens: ResourceResult<PersonalTokenSummary[], Record<string, never>>;
  onBack: () => void;
  onCreate: (name: string) => Promise<CreatedPersonalToken>;
  onRegenerate: (tokenId: string) => Promise<CreatedPersonalToken>;
  onRevoke: (tokenId: string) => Promise<void>;
}

export function ApiTokensScreen({
  personalTokens,
  onBack,
  onCreate,
  onRegenerate,
  onRevoke,
}: ApiTokensScreenProps): ReactNode {
  return (
    <Screen title="API tokens" backLabel="Back to settings" onBack={onBack}>
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
    </Screen>
  );
}
