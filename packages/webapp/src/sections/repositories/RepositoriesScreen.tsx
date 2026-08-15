import { InfoMessage, PressableListItem, Text, VStack } from "alouette";
import type { ReactNode } from "react";
import type { ResourceResult } from "react-liwi";
import type {
  QueryAccountRepositoriesParams,
  RepositorySummary,
} from "reviewflow-modules";
import { ListSection } from "#/components/list-section.tsx";
import { ResourceView } from "#/components/resource-view.tsx";
import { Screen } from "#/components/screen.tsx";

interface RepositoryListProps {
  repositories: RepositorySummary[];
  onSelectRepository: (repository: RepositorySummary) => void;
}

function RepositoryList({
  repositories,
  onSelectRepository,
}: RepositoryListProps): ReactNode {
  return (
    <VStack>
      {repositories.map((repository) => (
        <PressableListItem
          key={repository._id}
          onPress={() => {
            onSelectRepository(repository);
          }}
        >
          <Text className="font-body-bold">
            {`${repository.emoji ? `${repository.emoji} ` : ""}${repository.name}`}
          </Text>
        </PressableListItem>
      ))}
    </VStack>
  );
}

interface RepositoriesScreenProps {
  repositories: ResourceResult<
    RepositorySummary[],
    QueryAccountRepositoriesParams
  >;
  onSelectRepository: (repository: RepositorySummary) => void;
}

export function RepositoriesScreen({
  repositories,
  onSelectRepository,
}: RepositoriesScreenProps): ReactNode {
  return (
    <Screen title="Repositories">
      <ResourceView resource={repositories}>
        {(repositoryList) => {
          if (repositoryList.length === 0) {
            return (
              <InfoMessage>
                No repository seen yet. A repository shows up once reviewflow
                has handled an event for it.
              </InfoMessage>
            );
          }

          const activeRepositories = repositoryList.filter(
            (repository) => !repository.archived,
          );
          const archivedRepositories = repositoryList.filter(
            (repository) => repository.archived,
          );

          return (
            <VStack className="gap-l">
              <RepositoryList
                repositories={activeRepositories}
                onSelectRepository={onSelectRepository}
              />
              {archivedRepositories.length > 0 && (
                <ListSection title="Archived">
                  <RepositoryList
                    repositories={archivedRepositories}
                    onSelectRepository={onSelectRepository}
                  />
                </ListSection>
              )}
            </VStack>
          );
        }}
      </ResourceView>
    </Screen>
  );
}
