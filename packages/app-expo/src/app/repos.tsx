import type { CheckoutRepo } from "@reviewflow/sdk";
import { formatRelativeDate } from "@reviewflow/sdk";
import { checkoutSummaryParts, errorToMessage } from "@reviewflow/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Box,
  Button,
  Code,
  EmptyState,
  ErrorMessage,
  Icon,
  IconButton,
  IndeterminateCircularProgress,
  PressableListItem,
  ScreenScrollView,
  Text,
  View,
} from "alouette";
import { ArrowsClockwiseRegularIcon } from "alouette-icons/phosphor-icons/ArrowsClockwise";
import { FolderSimpleRegularIcon } from "alouette-icons/phosphor-icons/FolderSimple";
import { GitBranchRegularIcon } from "alouette-icons/phosphor-icons/GitBranch";
import { Link, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { refreshRepos, useRepoStatus, useRepos } from "#/services/reposApi.ts";

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

interface RepoRowStatusProps {
  ownerRepo: string;
}

/**
 * What the checkout holds and its last commit, as of the last fetch: read row
 * by row, so the list shows before every status answered.
 */
function RepoRowStatus({ ownerRepo }: RepoRowStatusProps): ReactNode {
  const { data } = useRepoStatus({ ownerRepo, worktree: null }, "local");
  if (data === undefined) return null;
  const { status } = data;
  const parts = checkoutSummaryParts(status);
  return (
    <>
      {parts.length === 0 ? null : (
        <Text className="text-sm text-muted">{parts.join(" · ")}</Text>
      )}
      {status.commit === null ? null : (
        <Text className="w-full text-xs text-muted" numberOfLines={1}>
          {`${status.commit.subject} · ${formatRelativeDate(status.commit.committedAt)}`}
        </Text>
      )}
    </>
  );
}

function RepoRow({ repo }: RepoRowProps): ReactNode {
  const router = useRouter();
  if (repo.problem !== null) return <UnusableRepoRow repo={repo} />;
  return (
    <PressableListItem
      role="link"
      aria-label={`Open ${repo.ownerRepo}`}
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
          <RepoRowStatus ownerRepo={repo.ownerRepo} />
        </View>
        <Text className="font-mono text-xs text-muted">{repo.path}</Text>
      </View>
    </PressableListItem>
  );
}

const describeRepoPaths = (repoPaths: string[]): string =>
  repoPaths.length === 0 ? "no repositories folder" : repoPaths.join(", ");

/**
 * The configured checkouts and the ones found directly under `repoPaths`
 * (marked "found"), each with what it holds against its remote: each opens
 * its worktrees and branches. The found ones come
 * from the server's last scan; Refresh scans the folders again.
 */
export default function ReposPage(): ReactNode {
  const client = useQueryClient();
  const { data, error, isPending } = useRepos();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<unknown>(null);

  const refresh = (): void => {
    setRefreshing(true);
    setRefreshError(null);
    refreshRepos(client)
      .catch((error_: unknown) => {
        setRefreshError(error_);
      })
      .finally(() => {
        setRefreshing(false);
      });
  };

  return (
    <ScreenScrollView>
      <View className="page-container gap-l py-l">
        <View className="flex-row flex-wrap items-center gap-m">
          <Text
            role="heading"
            aria-level={1}
            className="min-w-0 flex-1 font-heading-extrabold text-3xl xl:text-4xl"
          >
            Repositories
          </Text>
          <View className="flex-row items-center gap-xs">
            {data === undefined ? null : (
              <Text className="text-xs text-muted">
                {`Folders scanned ${formatRelativeDate(data.scannedAt)}`}
              </Text>
            )}
            <IconButton
              icon={<ArrowsClockwiseRegularIcon />}
              size="sm"
              variant="soft"
              accent="neutral"
              aria-label="Scan the repositories folders again"
              disabledReason={refreshing ? "Scanning…" : null}
              onPress={refresh}
            />
          </View>
        </View>
        {isPending ? <IndeterminateCircularProgress loading /> : null}
        {error === null ? null : <ErrorMessage>{error.message}</ErrorMessage>}
        {refreshError === null ? null : (
          <ErrorMessage>{errorToMessage(refreshError)}</ErrorMessage>
        )}
        {data?.repos.length === 0 ? (
          <View className="items-center gap-m">
            <EmptyState
              icon={<FolderSimpleRegularIcon />}
              title="No repository found"
            >
              {`No git checkout of a GitHub repository is directly under ${describeRepoPaths(data.repoPaths)}, and ${data.configPath} maps none.`}
            </EmptyState>
            <Link asChild href="/settings">
              <Button text="Open Settings" accent="brand" role="link" />
            </Link>
          </View>
        ) : null}
        {data === undefined || data.repos.length === 0 ? null : (
          <View className="gap-xs">
            {data.repos.map((repo) => (
              <RepoRow key={repo.ownerRepo} repo={repo} />
            ))}
          </View>
        )}
      </View>
    </ScreenScrollView>
  );
}
