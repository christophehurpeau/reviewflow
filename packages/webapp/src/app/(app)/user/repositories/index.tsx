import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useResource } from "react-liwi";
import { RepositoriesScreen } from "#/sections/repositories/RepositoriesScreen.tsx";
import { useAuthenticatedUser } from "#/services/AuthenticatedUserProvider.tsx";
import { useReviewflowServices } from "#/services/ReviewflowServicesProvider.tsx";

export default function UserRepositoriesPage(): ReactNode {
  const router = useRouter();
  const user = useAuthenticatedUser();
  const { repositoriesService } = useReviewflowServices();

  const repositories = useResource(
    repositoriesService.queries.queryAccountRepositories,
    { params: { accountId: user.id }, subscribe: true },
    [user.id],
  );

  return (
    <RepositoriesScreen
      repositories={repositories}
      onSelectRepository={(repository) => {
        router.navigate(
          `/user/repositories/${encodeURIComponent(repository.name)}`,
        );
      }}
    />
  );
}
