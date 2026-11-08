import type { CheckoutRepo } from "@reviewflow/sdk";
import {
  Badge,
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
          {repo.configured ? null : (
            <Badge accent="info" variant="outlined">
              found
            </Badge>
          )}
        </View>
        <Text className="font-mono text-xs text-muted">{repo.path}</Text>
      </View>
    </PressableListItem>
  );
}

/**
 * The configured checkouts, then the ones found directly under
 * `defaultRepoPath` (marked "found"): each opens its checked-out branch.
 */
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
              title="No repository found"
            >
              {`No git checkout of a GitHub repository is directly under ${data.defaultRepoPath}, and ${data.configPath} maps none.`}
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
