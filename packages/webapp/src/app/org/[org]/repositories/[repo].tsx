import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useResource } from "react-liwi";
import { RepositoryScreen } from "#/sections/repositories/RepositoryScreen.tsx";
import { useOrg } from "#/services/OrgProvider.tsx";
import { useReviewflowServices } from "#/services/ReviewflowServicesProvider.tsx";

export default function RepositoryPage(): ReactNode {
  const { repo } = useLocalSearchParams<{ repo: string }>();
  const router = useRouter();
  const org = useOrg();
  const { repositoriesService } = useReviewflowServices();

  const repository = useResource(
    repositoriesService.queries.queryRepository,
    { params: { orgId: org._id, name: repo }, subscribe: true },
    [org._id, repo],
  );

  return (
    <RepositoryScreen
      repositoryName={repo}
      repository={repository}
      onBack={() => {
        router.navigate(`/org/${org.login}/repositories`);
      }}
    />
  );
}
