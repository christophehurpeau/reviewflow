import { InfoMessage, PressableListItem, Text, VStack } from "alouette";
import type { ReactNode } from "react";
import type { ResourceResult } from "react-liwi";
import type {
  QueryOrgRepositoriesParams,
  RepositorySummary,
} from "reviewflow-modules";
import { ResourceView } from "#/components/resource-view.tsx";
import { Screen } from "#/components/screen.tsx";

interface RepositoriesScreenProps {
  repositories: ResourceResult<RepositorySummary[], QueryOrgRepositoriesParams>;
  onSelectRepository: (repository: RepositorySummary) => void;
}

export function RepositoriesScreen({
  repositories,
  onSelectRepository,
}: RepositoriesScreenProps): ReactNode {
  return (
    <Screen title="Repositories">
      <ResourceView resource={repositories}>
        {(repositoryList) =>
          repositoryList.length === 0 ? (
            <InfoMessage>
              No repository seen yet. A repository shows up once reviewflow has
              handled an event for it.
            </InfoMessage>
          ) : (
            <VStack>
              {repositoryList.map((repository) => (
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
          )
        }
      </ResourceView>
    </Screen>
  );
}
