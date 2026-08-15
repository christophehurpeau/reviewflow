import {
  ActionButton,
  ConfirmationMessage,
  ExternalLinkButton,
  HStack,
  VStack,
  WarningMessage,
} from "alouette";
import type { ReactNode } from "react";
import type { ResourceResult } from "react-liwi";
import type { UserSummary } from "reviewflow-modules";
import { ResourceView } from "#/components/resource-view.tsx";
import { Screen } from "#/components/screen.tsx";
import { SkeletonBlock } from "#/components/skeleton.tsx";
import { errorToMessage } from "#/errorToMessage.ts";
import { reviewflowName } from "#/reviewflowName.ts";

const userInstallUrl = `https://github.com/settings/apps/${reviewflowName}/installations/new`;

interface UserScreenProps {
  me: ResourceResult<UserSummary | undefined, Record<string, never>>;
  onForceSync: () => Promise<void>;
}

export function UserScreen({ me, onForceSync }: UserScreenProps): ReactNode {
  return (
    <Screen title="">
      <ResourceView resource={me} loading={<SkeletonBlock />}>
        {(user) =>
          user?.installed ? (
            <VStack className="gap-m">
              <ConfirmationMessage>
                {`${reviewflowName} is installed for this user.`}
              </ConfirmationMessage>
              <HStack>
                <ActionButton
                  text="Force sync"
                  onPress={onForceSync}
                  errorToMessage={errorToMessage}
                />
              </HStack>
            </VStack>
          ) : (
            <VStack className="gap-m">
              <WarningMessage>
                {`${reviewflowName} is not installed for this user.`}
              </WarningMessage>
              <HStack>
                <ExternalLinkButton
                  href={userInstallUrl}
                  text="Open github configuration"
                />
              </HStack>
            </VStack>
          )
        }
      </ResourceView>
    </Screen>
  );
}
