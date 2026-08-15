import {
  ActionButton,
  ExternalLinkButton,
  HStack,
  InfoMessage,
  Text,
  VStack,
  WarningMessage,
} from "alouette";
import type { ReactNode } from "react";
import type { ResourceResult } from "react-liwi";
import type {
  QueryRepositoryParams,
  RepositorySummary,
} from "reviewflow-modules";
import { ResourceView } from "#/components/resource-view.tsx";
import { Screen } from "#/components/screen.tsx";
import { SkeletonBlock } from "#/components/skeleton.tsx";
import { errorToMessage } from "#/errorToMessage.ts";

interface RepositoryScreenProps {
  repositoryName: string;
  repository: ResourceResult<
    RepositorySummary | undefined,
    QueryRepositoryParams
  >;
  onBack: () => void;
  onSync: (repositoryId: number) => Promise<void>;
}

export function RepositoryScreen({
  repositoryName,
  repository,
  onBack,
  onSync,
}: RepositoryScreenProps): ReactNode {
  return (
    <Screen
      title={repositoryName}
      backLabel="Back to repositories"
      onBack={onBack}
    >
      <ResourceView resource={repository} loading={<SkeletonBlock />}>
        {(repositoryData) =>
          repositoryData ? (
            <VStack className="gap-m">
              {repositoryData.archived && (
                <WarningMessage>
                  This repository is archived on github. Its pull requests are
                  no longer available. Unarchiving it brings reviewflow back.
                </WarningMessage>
              )}
              <InfoMessage>
                Per repository settings are not editable here yet.
              </InfoMessage>
              <VStack className="gap-xs">
                <Text className="font-body text-muted">
                  Resyncing reads the repository again from github: its name,
                  its settings and its labels. An archived repository is kept
                  without its pull requests. One that is deleted or no longer
                  part of the installation is removed from reviewflow.
                </Text>
                <HStack className="gap-s">
                  <ActionButton
                    text="Resync"
                    onPress={() => onSync(repositoryData._id)}
                    errorToMessage={errorToMessage}
                  />
                  <ExternalLinkButton
                    href={`https://github.com/${repositoryData.fullName}`}
                    text="Open on github"
                    variant="outlined"
                  />
                </HStack>
              </VStack>
            </VStack>
          ) : (
            <WarningMessage>
              This repository is not known to reviewflow.
            </WarningMessage>
          )
        }
      </ResourceView>
    </Screen>
  );
}
