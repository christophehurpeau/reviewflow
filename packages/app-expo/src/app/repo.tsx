import type { CheckoutWorktree, WorktreeRemovalResult } from "@reviewflow/sdk";
import type { CheckoutRead } from "@reviewflow/ui";
import { RemoveWorktreeButton, RepoOverview } from "@reviewflow/ui";
import type { UseQueryResult } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import {
  ConfirmationMessage,
  ErrorMessage,
  IconButton,
  ScreenScrollView,
  View,
  WarningMessage,
} from "alouette";
import { ArrowLeftRegularIcon } from "alouette-icons/phosphor-icons/ArrowLeft";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { rememberPullRequest } from "#/services/recentPullRequests.ts";
import {
  invalidateRepo,
  readWorktreeRemovalCheck,
  removeWorktree,
  useRepoBranches,
  useRepoPulls,
} from "#/services/reposApi.ts";

const first = (value: string[] | string | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const readOf = <Value,>(query: UseQueryResult<Value>): CheckoutRead<Value> => ({
  value: query.data ?? null,
  error: query.error?.message ?? null,
  loading: query.isFetching,
});

interface RemovalNoticeProps {
  removal: WorktreeRemovalResult;
  onDismiss: () => void;
}

/** What the last removal did: the branch git kept is the one thing left to act on. */
function RemovalNotice({ removal, onDismiss }: RemovalNoticeProps): ReactNode {
  if (removal.branchError !== null) {
    return (
      <WarningMessage dismissIconAriaLabel="Dismiss" onDismiss={onDismiss}>
        {`Removed ${removal.path}. git kept the branch ${removal.branch ?? ""}: ${removal.branchError}`}
      </WarningMessage>
    );
  }
  return (
    <ConfirmationMessage dismissIconAriaLabel="Dismiss" onDismiss={onDismiss}>
      {removal.branch === null
        ? `Removed ${removal.path}.`
        : `Removed ${removal.path} and the branch ${removal.branch}.`}
    </ConfirmationMessage>
  );
}

interface RepoOverviewScreenProps {
  ownerRepo: string;
  back: ReactNode;
}

function RepoOverviewScreen({
  ownerRepo,
  back,
}: RepoOverviewScreenProps): ReactNode {
  const router = useRouter();
  const client = useQueryClient();
  const branches = useRepoBranches(ownerRepo);
  const pulls = useRepoPulls(ownerRepo);
  const [removal, setRemoval] = useState<WorktreeRemovalResult | null>(null);

  const openWorktree = (worktree: CheckoutWorktree): void => {
    router.push({
      pathname: "/checkout",
      params: worktree.main
        ? { repo: ownerRepo }
        : { repo: ownerRepo, worktree: worktree.path },
    });
  };

  const openPullRequest = (number: number): void => {
    rememberPullRequest({ ownerRepo, number });
    router.push({
      pathname: "/pull-request",
      params: { repo: ownerRepo, number: String(number) },
    });
  };

  return (
    <RepoOverview
      ownerRepo={ownerRepo}
      branches={readOf(branches)}
      pulls={readOf(pulls)}
      headerStart={back}
      notices={
        removal === null ? null : (
          <RemovalNotice
            removal={removal}
            onDismiss={() => {
              setRemoval(null);
            }}
          />
        )
      }
      renderWorktreeActions={(worktree) => {
        if (worktree.main || worktree.prunable) return null;
        const checkout = { ownerRepo, worktree: worktree.path };
        return (
          <RemoveWorktreeButton
            path={worktree.path}
            readCheck={() => readWorktreeRemovalCheck(checkout)}
            onRemove={(deleteBranch) => removeWorktree(checkout, deleteBranch)}
            onRemoved={(result) => {
              setRemoval(result);
              invalidateRepo(client, ownerRepo).catch(() => undefined);
            }}
          />
        );
      }}
      onOpenWorktree={openWorktree}
      onOpenPullRequest={openPullRequest}
      onReload={() => {
        // a failed read is the query's error, shown in place
        invalidateRepo(client, ownerRepo).catch(() => undefined);
        pulls.refetch().catch(() => undefined);
      }}
    />
  );
}

/** One listed repository: its worktrees, its branches and their pull requests. */
export default function RepoPage(): ReactNode {
  const router = useRouter();
  const params = useLocalSearchParams<{ repo?: string }>();
  const ownerRepo = first(params.repo) ?? "";
  const valid = /^[^/\s]+\/[^/\s]+$/.test(ownerRepo);

  const back = (
    <IconButton
      icon={<ArrowLeftRegularIcon />}
      size="sm"
      aria-label="Back to the repositories"
      onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/repos");
      }}
    />
  );

  return (
    <ScreenScrollView>
      <View className="page-container gap-l py-l">
        {valid ? (
          <RepoOverviewScreen ownerRepo={ownerRepo} back={back} />
        ) : (
          <>
            <View className="flex-row">{back}</View>
            <ErrorMessage>
              This address is not a repository: it needs ?repo=owner/repo.
            </ErrorMessage>
          </>
        )}
      </View>
    </ScreenScrollView>
  );
}
