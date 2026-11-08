import type { CheckoutRepo } from "@reviewflow/sdk";
import {
  Box,
  Button,
  Code,
  EmptyState,
  ErrorMessage,
  Icon,
  IndeterminateCircularProgress,
  PressableListItem,
  ScreenScrollView,
  SectionTitle,
  Text,
  View,
} from "alouette";
import { FolderSimpleRegularIcon } from "alouette-icons/phosphor-icons/FolderSimple";
import { GitBranchRegularIcon } from "alouette-icons/phosphor-icons/GitBranch";
import { Link, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useRepos } from "#/services/reposApi.ts";

interface RepoRowProps {
  repo: CheckoutRepo;
}

/** A checkout that cannot be read says why, and opens nothing. */
function UnusableRepoRow({ repo }: RepoRowProps): ReactNode {
  return (
    <Box className="surface gap-xxs px-m py-m">
      <Text className="font-body-bold">{repo.ownerRepo}</Text>
      <Text className="font-mono text-xs text-muted">{repo.path}</Text>
      <Text className="text-sm text-muted">{repo.problem}</Text>
    </Box>
  );
}

function RepoRow({ repo }: RepoRowProps): ReactNode {
  const router = useRouter();
  if (repo.problem !== null) return <UnusableRepoRow repo={repo} />;
  return (
    <PressableListItem
      role="link"
      aria-label={`Diff of ${repo.ownerRepo}`}
      onPress={() => {
        router.push({ pathname: "/repo", params: { repo: repo.ownerRepo } });
      }}
    >
      <View className="gap-xxs">
        <View className="flex-row flex-wrap items-center gap-sm">
          <Text className="font-body-bold">{repo.ownerRepo}</Text>
          <View className="flex-row items-center gap-xxs">
            <Icon icon={<GitBranchRegularIcon />} size={14} />
            <Code className="text-sm">{repo.branch ?? "detached HEAD"}</Code>
          </View>
        </View>
        <Text className="font-mono text-xs text-muted">{repo.path}</Text>
      </View>
    </PressableListItem>
  );
}

/** The configured checkouts: each opens its checked-out branch's diff. */
export default function ReposPage(): ReactNode {
  const { data, error, isPending } = useRepos();

  return (
    <ScreenScrollView>
      <View className="page-container gap-m py-l">
        <SectionTitle icon={<FolderSimpleRegularIcon />}>
          Repositories
        </SectionTitle>
        {isPending ? <IndeterminateCircularProgress loading /> : null}
        {error === null ? null : <ErrorMessage>{error.message}</ErrorMessage>}
        {data?.repos.length === 0 ? (
          <View className="items-center gap-m">
            <EmptyState
              icon={<FolderSimpleRegularIcon />}
              title="No repository configured"
            >
              {`Map owner/repo to a checkout in ${data.configPath} to see its branch here.`}
            </EmptyState>
            <Link asChild href="/settings">
              <Button text="Open Settings" accent="brand" role="link" />
            </Link>
          </View>
        ) : null}
        {data?.repos.map((repo) => (
          <RepoRow key={repo.ownerRepo} repo={repo} />
        ))}
      </View>
    </ScreenScrollView>
  );
}
