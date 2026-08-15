import {
  ExternalLinkButton,
  HStack,
  InfoMessage,
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

interface RepositoryScreenProps {
  repositoryName: string;
  repository: ResourceResult<
    RepositorySummary | undefined,
    QueryRepositoryParams
  >;
  onBack: () => void;
}

export function RepositoryScreen({
  repositoryName,
  repository,
  onBack,
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
              <InfoMessage>
                Per repository settings are not editable here yet.
              </InfoMessage>
              <HStack>
                <ExternalLinkButton
                  href={`https://github.com/${repositoryData.fullName}`}
                  text="Open on github"
                />
              </HStack>
            </VStack>
          ) : (
            <WarningMessage>
              This repository is not known to reviewflow yet.
            </WarningMessage>
          )
        }
      </ResourceView>
    </Screen>
  );
}
