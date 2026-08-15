import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useResource } from "react-liwi";
import { RepositoryScreen } from "#/sections/repositories/RepositoryScreen.tsx";
import { useAuthenticatedUser } from "#/services/AuthenticatedUserProvider.tsx";
import { useReviewflowServices } from "#/services/ReviewflowServicesProvider.tsx";

export default function UserRepositoryPage(): ReactNode {
  const { repo } = useLocalSearchParams<{ repo: string }>();
  const router = useRouter();
  const user = useAuthenticatedUser();
  const { repositoriesService } = useReviewflowServices();

  const repository = useResource(
    repositoriesService.queries.queryRepository,
    { params: { accountId: user.id, name: repo }, subscribe: true },
    [user.id, repo],
  );

  return (
    <RepositoryScreen
      repositoryName={repo}
      repository={repository}
      onBack={() => {
        router.navigate("/user/repositories");
      }}
      onSync={(repositoryId) =>
        repositoriesService.operations.syncRepository({
          accountId: user.id,
          repositoryId,
        })
      }
    />
  );
}
