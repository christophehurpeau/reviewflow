import type {
  CheckoutBranchesResponse,
  CheckoutWorktree,
  CheckoutWorktreeStatus,
  WorktreeRemovalResult,
} from "@reviewflow/sdk";
import type {
  CheckoutRead,
  PullRequestTab,
  RepoSelection,
} from "@reviewflow/ui";
import {
  DiffSettingsProvider,
  PullRequestSlotsProvider,
  RemoveWorktreeButton,
  RepoSidebar,
  isPullRequestTab,
} from "@reviewflow/ui";
import type { UseQueryResult } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import {
  ConfirmationMessage,
  EmptyState,
  ErrorMessage,
  IconButton,
  IndeterminateCircularProgress,
  ScrollView,
  View,
  WarningMessage,
} from "alouette";
import { ArrowLeftRegularIcon } from "alouette-icons/phosphor-icons/ArrowLeft";
import { SidebarSimpleRegularIcon } from "alouette-icons/phosphor-icons/SidebarSimple";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { pullRequestStatusSlots } from "#/services/BranchPullRequests.tsx";
import { useDiffPreferences } from "#/services/DiffPreferencesProvider.tsx";
import { PullRequestView } from "#/services/PullRequestView.tsx";
import { RepoBranchPane } from "#/services/RepoBranchPane.tsx";
import { RepoCheckoutPane } from "#/services/RepoCheckoutPane.tsx";
import { useRepoWatch } from "#/services/repoWatch.ts";
import type { CheckoutRef } from "#/services/reposApi.ts";
import {
  invalidateRepo,
  readWorktreeRemovalCheck,
  removeWorktree,
  useCachedRepoStatus,
  useRepoBranches,
  useRepoPulls,
  useRepoSettledPulls,
  useRepoWorktreeStatuses,
} from "#/services/reposApi.ts";

const first = (value: string[] | string | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const readOf = <Value,>(query: UseQueryResult<Value>): CheckoutRead<Value> => ({
  value: query.data ?? null,
  error: query.error?.message ?? null,
  loading: query.isFetching,
});

const selectionOf = (
  worktree: string | undefined,
  branch: string | undefined,
): RepoSelection | null => {
  if (worktree !== undefined && worktree !== "") {
    return { kind: "worktree", path: worktree };
  }
  if (branch !== undefined && branch !== "") {
    return { kind: "branch", name: branch };
  }
  return null;
};

const selectionKey = (selection: RepoSelection): string =>
  selection.kind === "worktree"
    ? `worktree\n${selection.path}`
    : `branch\n${selection.name}`;

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

function Loading(): ReactNode {
  return (
    <View className="flex-1 items-center justify-center">
      <IndeterminateCircularProgress loading />
    </View>
  );
}

interface SelectedPaneProps {
  ownerRepo: string;
  selection: RepoSelection;
  overview: CheckoutBranchesResponse | undefined;
  /** shown on a narrow screen only, where the sidebar is hidden behind the pane */
  backToSidebar: ReactNode;
  onRemoved: (result: WorktreeRemovalResult) => void;
  onOpenPullRequest: (number: number) => void;
}

/**
 * The selected worktree's checkout, or the selected branch read from the
 * listed checkout. The main worktree is read as the listed checkout itself.
 */
function SelectedPane({
  ownerRepo,
  selection,
  overview,
  backToSidebar,
  onRemoved,
  onOpenPullRequest,
}: SelectedPaneProps): ReactNode {
  const { settings, loaded } = useDiffPreferences();
  // the whitespace preference is read once, when the pane mounts
  if (!loaded) return null;
  const initialWhitespace = settings.hideWhitespace ? "hide" : "show";

  const pane = ((): ReactNode => {
    if (selection.kind === "branch") {
      return (
        <RepoBranchPane
          ownerRepo={ownerRepo}
          branchName={selection.name}
          initialWhitespace={initialWhitespace}
          headerStart={backToSidebar}
          onOpenPullRequest={onOpenPullRequest}
        />
      );
    }
    if (overview === undefined) return <Loading />;
    const worktree = overview.worktrees.find(
      ({ path, prunable }) => path === selection.path && !prunable,
    );
    if (worktree === undefined) {
      return (
        <View className="gap-m p-m">
          <View className="flex-row">{backToSidebar}</View>
          <WarningMessage>
            {`${selection.path} is not a worktree of ${ownerRepo} anymore.`}
          </WarningMessage>
        </View>
      );
    }
    const checkout = {
      ownerRepo,
      worktree: worktree.main ? null : worktree.path,
    };
    return (
      <RepoCheckoutPane
        checkout={checkout}
        initialWhitespace={initialWhitespace}
        headerStart={backToSidebar}
        headerExtra={
          worktree.main ? null : (
            <RemoveWorktreeButton
              path={worktree.path}
              readCheck={() => readWorktreeRemovalCheck(checkout)}
              onRemove={(deleteBranch) =>
                removeWorktree(checkout, deleteBranch)
              }
              onRemoved={onRemoved}
            />
          )
        }
        onOpenPullRequest={onOpenPullRequest}
      />
    );
  })();

  return (
    <DiffSettingsProvider
      theme={settings.theme}
      font={settings.font}
      customFont={settings.customFont}
      wordWrap={settings.wordWrap}
    >
      {pane}
    </DiffSettingsProvider>
  );
}

/** A pull request open beside the sidebar, over the worktree or branch it was opened from. */
interface OpenPullRequest {
  number: number;
  tab: PullRequestTab | undefined;
  commit: string | null;
}

interface PullRequestPaneProps {
  ownerRepo: string;
  pullRequest: OpenPullRequest;
  /** back to the worktree or branch it was opened from, or to the sidebar */
  back: ReactNode;
  onChange: (next: { tab?: PullRequestTab; commit?: string | null }) => void;
}

function PullRequestPane({
  ownerRepo,
  pullRequest,
  back,
  onChange,
}: PullRequestPaneProps): ReactNode {
  return (
    // the diff keeps its toolbar in view under the nearest vertical scroller
    <ScrollView className="flex-1">
      <PullRequestView
        ownerRepo={ownerRepo}
        number={pullRequest.number}
        tab={pullRequest.tab}
        headerStart={back}
        openCommit={pullRequest.commit}
        onOpenCommitChange={(oid) => {
          onChange({ commit: oid });
        }}
        onTabChange={(next) => {
          onChange({ tab: next, commit: null });
        }}
      />
    </ScrollView>
  );
}

/** The checkout the selection reads, the main worktree as the listed checkout itself. */
const checkoutOf = (
  ownerRepo: string,
  selection: RepoSelection | null,
  overview: CheckoutBranchesResponse | undefined,
): CheckoutRef | null => {
  if (selection?.kind !== "worktree") return { ownerRepo, worktree: null };
  const worktree = overview?.worktrees.find(
    ({ path }) => path === selection.path,
  );
  if (worktree === undefined) return null;
  return { ownerRepo, worktree: worktree.main ? null : worktree.path };
};

/**
 * The statuses as last read, the selected worktree's replaced by the status
 * its pane keeps up to date: a file change re-reads that one alone.
 */
const withSelectedStatus = (
  statuses: CheckoutWorktreeStatus[] | undefined,
  selection: RepoSelection | null,
  selectedStatus: CheckoutWorktreeStatus["status"] | undefined,
): CheckoutWorktreeStatus[] | null => {
  if (statuses === undefined) return null;
  if (selection?.kind !== "worktree" || selectedStatus === undefined) {
    return statuses;
  }
  return statuses.map((entry) =>
    entry.path === selection.path
      ? { ...entry, status: selectedStatus }
      : entry,
  );
};

interface RepoWorkspaceProps {
  ownerRepo: string;
  selection: RepoSelection | null;
  pullRequest: OpenPullRequest | null;
}

/**
 * The repository as a workspace: the sidebar lists what can be worked on, the
 * pane shows the selected worktree, branch or pull request. Picking another
 * one keeps the sidebar and its reads; on a narrow screen the pane covers the
 * sidebar. What moves on disk is followed live (`useRepoWatch`).
 */
function RepoWorkspace({
  ownerRepo,
  selection,
  pullRequest,
}: RepoWorkspaceProps): ReactNode {
  const router = useRouter();
  const client = useQueryClient();
  const branches = useRepoBranches(ownerRepo);
  const worktreeStatuses = useRepoWorktreeStatuses(ownerRepo);
  const pulls = useRepoPulls(ownerRepo);
  const settledPulls = useRepoSettledPulls(ownerRepo);
  const [removal, setRemoval] = useState<WorktreeRemovalResult | null>(null);
  const watched = checkoutOf(ownerRepo, selection, branches.data);
  useRepoWatch(watched);
  const selectedStatus = useCachedRepoStatus(
    selection?.kind === "worktree" ? watched : null,
  );
  const showsPane = selection !== null || pullRequest !== null;

  const select = (next: RepoSelection | null): void => {
    router.setParams({
      worktree: next?.kind === "worktree" ? next.path : undefined,
      branch: next?.kind === "branch" ? next.name : undefined,
      pr: undefined,
      prTab: undefined,
      prCommit: undefined,
    });
  };

  // the worktree or branch stays in the url: closing the pull request goes back to it
  const openPullRequest = (number: number): void => {
    router.setParams({
      pr: String(number),
      prTab: undefined,
      prCommit: undefined,
    });
  };

  const backToRepos = (
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

  const backToSidebar = (
    <View className="lg:hidden">
      <IconButton
        icon={<SidebarSimpleRegularIcon />}
        size="sm"
        aria-label={`Back to ${ownerRepo}'s worktrees and branches`}
        onPress={() => {
          select(null);
        }}
      />
    </View>
  );

  const closePullRequest = (
    <IconButton
      icon={<ArrowLeftRegularIcon />}
      size="sm"
      aria-label={
        selection === null
          ? `Back to ${ownerRepo}'s worktrees and branches`
          : "Back to the checkout"
      }
      onPress={() => {
        router.setParams({
          pr: undefined,
          prTab: undefined,
          prCommit: undefined,
        });
      }}
    />
  );

  const pane = ((): ReactNode => {
    if (pullRequest !== null) {
      return (
        <PullRequestPane
          key={pullRequest.number}
          ownerRepo={ownerRepo}
          pullRequest={pullRequest}
          back={closePullRequest}
          onChange={(next) => {
            router.setParams({
              prTab: next.tab ?? pullRequest.tab,
              prCommit:
                next.commit === undefined
                  ? (pullRequest.commit ?? undefined)
                  : (next.commit ?? undefined),
            });
          }}
        />
      );
    }
    if (selection === null) {
      return (
        <View className="flex-1 items-center justify-center p-l">
          <EmptyState
            icon={<SidebarSimpleRegularIcon />}
            title="Pick a worktree or a branch"
          >
            Its changes, its history and its files open here.
          </EmptyState>
        </View>
      );
    }
    return (
      <SelectedPane
        // another selection is another screen: its tab and open commit start over
        key={selectionKey(selection)}
        ownerRepo={ownerRepo}
        selection={selection}
        overview={branches.data}
        backToSidebar={backToSidebar}
        onOpenPullRequest={openPullRequest}
        onRemoved={(result) => {
          setRemoval(result);
          select(null);
          invalidateRepo(client, ownerRepo).catch(() => undefined);
        }}
      />
    );
  })();

  return (
    <View className="min-h-0 flex-1 flex-row">
      <ScrollView
        className={
          showsPane
            ? "hidden lg:flex lg:w-[380px] lg:flex-none lg:border-r lg:border-border-muted"
            : "w-full lg:w-[380px] lg:flex-none lg:border-r lg:border-border-muted"
        }
        contentContainerClassName="p-m"
      >
        <PullRequestSlotsProvider value={pullRequestStatusSlots}>
          <RepoSidebar
            ownerRepo={ownerRepo}
            branches={readOf(branches)}
            worktreeStatuses={withSelectedStatus(
              worktreeStatuses.data?.statuses,
              selection,
              selectedStatus?.status,
            )}
            pulls={readOf(pulls)}
            settledPullRequests={settledPulls.data?.branches ?? []}
            selection={selection}
            selectedPullRequest={pullRequest?.number ?? null}
            headerStart={backToRepos}
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
            onSelectWorktree={(worktree: CheckoutWorktree) => {
              select({ kind: "worktree", path: worktree.path });
            }}
            onSelectBranch={(branch: string) => {
              select({ kind: "branch", name: branch });
            }}
            onOpenPullRequest={openPullRequest}
            onReload={() => {
              // a failed read is the query's error, shown in place
              invalidateRepo(client, ownerRepo).catch(() => undefined);
              pulls.refetch().catch(() => undefined);
              settledPulls.refetch().catch(() => undefined);
            }}
          />
        </PullRequestSlotsProvider>
      </ScrollView>
      <View
        className={
          showsPane ? "min-h-0 flex-1" : "hidden min-h-0 lg:flex lg:flex-1"
        }
      >
        {pane}
      </View>
    </View>
  );
}

const pullRequestOf = (
  pr: string | undefined,
  tab: string | undefined,
  commit: string | undefined,
): OpenPullRequest | null => {
  const number = Number(pr ?? "");
  if (!Number.isInteger(number) || number < 1) return null;
  return {
    number,
    tab: isPullRequestTab(tab) ? tab : undefined,
    commit: commit === undefined || commit === "" ? null : commit,
  };
};

/**
 * One listed repository: its worktrees, its branches and their pull requests,
 * and the one being worked on. The url holds the selection (`worktree` or
 * `branch`, and `pr` over it), so a reload or a shared link reopens it.
 */
export default function RepoPage(): ReactNode {
  const router = useRouter();
  const params = useLocalSearchParams<{
    repo?: string;
    worktree?: string;
    branch?: string;
    pr?: string;
    prTab?: string;
    prCommit?: string;
  }>();
  const ownerRepo = first(params.repo) ?? "";
  const valid = /^[^/\s]+\/[^/\s]+$/.test(ownerRepo);

  if (!valid) {
    return (
      <View className="mx-auto w-full max-w-[1200px] gap-m px-l pt-l">
        <View className="flex-row">
          <IconButton
            icon={<ArrowLeftRegularIcon />}
            size="sm"
            aria-label="Back to the repositories"
            onPress={() => {
              router.replace("/repos");
            }}
          />
        </View>
        <ErrorMessage>
          This address is not a repository: it needs ?repo=owner/repo.
        </ErrorMessage>
      </View>
    );
  }

  return (
    <RepoWorkspace
      key={ownerRepo}
      ownerRepo={ownerRepo}
      selection={selectionOf(first(params.worktree), first(params.branch))}
      pullRequest={pullRequestOf(
        first(params.pr),
        first(params.prTab),
        first(params.prCommit),
      )}
    />
  );
}
