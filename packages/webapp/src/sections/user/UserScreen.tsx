import {
  ActionButton,
  ConfirmationMessage,
  ExternalLinkButton,
  View,
  WarningMessage,
} from "alouette";
import type { ReactNode } from "react";
import type { ResourceResult } from "react-liwi";
import type {
  CreatedPersonalToken,
  PersonalTokenSummary,
  UserSummary,
} from "reviewflow-modules";
import { ResourceView } from "#/components/resource-view.tsx";
import { Screen } from "#/components/screen.tsx";
import { SkeletonBlock } from "#/components/skeleton.tsx";
import { errorToMessage } from "#/errorToMessage.ts";
import { reviewflowName } from "#/reviewflowName.ts";
import { PersonalTokensSection } from "./PersonalTokensSection.tsx";

const userInstallUrl = `https://github.com/settings/apps/${reviewflowName}/installations/new`;

interface UserScreenProps {
  me: ResourceResult<UserSummary | undefined, Record<string, never>>;
  personalTokens: ResourceResult<PersonalTokenSummary[], Record<string, never>>;
  onForceSync: () => Promise<void>;
  onCreatePersonalToken: (name: string) => Promise<CreatedPersonalToken>;
  onRegeneratePersonalToken: (tokenId: string) => Promise<CreatedPersonalToken>;
  onRevokePersonalToken: (tokenId: string) => Promise<void>;
}

export function UserScreen({
  me,
  personalTokens,
  onForceSync,
  onCreatePersonalToken,
  onRegeneratePersonalToken,
  onRevokePersonalToken,
}: UserScreenProps): ReactNode {
  return (
    <Screen title="">
      <View className="gap-l">
        <ResourceView resource={me} loading={<SkeletonBlock />}>
          {(user) =>
            user?.installed ? (
              <View className="gap-m">
                <ConfirmationMessage>
                  {`${reviewflowName} is installed for this user.`}
                </ConfirmationMessage>
                <View className="flex-row">
                  <ActionButton
                    text="Force sync"
                    errorToMessage={errorToMessage}
                    onPress={onForceSync}
                  />
                </View>
              </View>
            ) : (
              <View className="gap-m">
                <WarningMessage>
                  {`${reviewflowName} is not installed for this user.`}
                </WarningMessage>
                <View className="flex-row">
                  <ExternalLinkButton
                    href={userInstallUrl}
                    text="Open github configuration"
                  />
                </View>
              </View>
            )
          }
        </ResourceView>
        <ResourceView resource={personalTokens} loading={<SkeletonBlock />}>
          {(tokens) => (
            <PersonalTokensSection
              tokens={tokens}
              onCreate={onCreatePersonalToken}
              onRegenerate={onRegeneratePersonalToken}
              onRevoke={onRevokePersonalToken}
            />
          )}
        </ResourceView>
      </View>
    </Screen>
  );
}
