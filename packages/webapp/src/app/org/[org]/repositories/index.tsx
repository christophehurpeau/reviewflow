import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useResource } from "react-liwi";
import { RepositoriesScreen } from "#/sections/repositories/RepositoriesScreen.tsx";
import { useOrg } from "#/services/OrgProvider.tsx";
import { useReviewflowServices } from "#/services/ReviewflowServicesProvider.tsx";

export default function RepositoriesPage(): ReactNode {
  const router = useRouter();
  const org = useOrg();
  const { repositoriesService } = useReviewflowServices();

  const repositories = useResource(
    repositoriesService.queries.queryOrgRepositories,
    { params: { orgId: org._id }, subscribe: true },
    [org._id],
  );

  return (
    <RepositoriesScreen
      repositories={repositories}
      onSelectRepository={(repository) => {
        router.navigate(
          `/org/${org.login}/repositories/${encodeURIComponent(repository.name)}`,
        );
      }}
    />
  );
}
