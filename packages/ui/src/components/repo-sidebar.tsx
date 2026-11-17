import type {
  BranchPullRequest,
  CheckoutBranch,
  CheckoutBranchesResponse,
  CheckoutStatus,
  CheckoutWorktree,
  CheckoutWorktreeStatus,
  OpenPullRequest,
  OpenPullRequestsResponse,
  SettledBranchPullRequest,
} from "@reviewflow/sdk";
import {
  formatRelativeDate,
  pluralOf,
  pullRequestOfBranch,
  pullRequestsWithoutBranch,
} from "@reviewflow/sdk";
import {
  Badge,
  Button,
  Code,
  Icon,
  IndeterminateCircularProgress,
  PressableBox,
  SectionTitle,
  Text,
  View,
  WarningMessage,
} from "alouette";
import { ArrowsClockwiseRegularIcon } from "alouette-icons/phosphor-icons/ArrowsClockwise";
import { BroomRegularIcon } from "alouette-icons/phosphor-icons/Broom";
import { FolderSimpleRegularIcon } from "alouette-icons/phosphor-icons/FolderSimple";
import { GitBranchRegularIcon } from "alouette-icons/phosphor-icons/GitBranch";
import { GitPullRequestRegularIcon } from "alouette-icons/phosphor-icons/GitPullRequest";
import type { ReactNode } from "react";
import { useState } from "react";
import { usePrStatusAccent } from "../prStatus.ts";
import {
  branchTrackParts,
  checkoutSummaryParts,
} from "../services/checkoutSummary.ts";
import type { CheckoutRead } from "./checkout-view.tsx";
import { TooltipIconButton } from "./tooltip-icon-button.tsx";

/** Past this many, the older branches wait behind a press. */
const shownBranches = 20;

/** What the screen beside the sidebar shows: a worktree's checkout, or a branch no worktree has out. */
export type RepoSelection =
  | { kind: "worktree"; path: string }
  | { kind: "branch"; name: string };

const folderName = (path: string): string =>
  path.split(/[/\\]/).findLast((part) => part !== "") ?? path;

function Loading(): ReactNode {
  return (
    <View className="items-center py-l">
      <IndeterminateCircularProgress loading />
    </View>
  );
}

interface SidebarRowProps {
  selected: boolean;
  "aria-label": string;
  onPress: () => void;
  children: ReactNode;
}

/** The sidebar's material: flat on its ground, the selected row raised, as `SidebarNav` draws them. */
function SidebarRow({
  selected,
  "aria-label": ariaLabel,
  onPress,
  children,
}: SidebarRowProps): ReactNode {
  return (
    <PressableBox
      variant={selected ? "tonal" : "soft"}
      accessibilityState={{ selected }}
      aria-label={ariaLabel}
      className="gap-xxs rounded-sm px-sm py-xs"
      onPress={onPress}
    >
      {children}
    </PressableBox>
  );
}

interface OpenPullRequestBadgeProps {
  pullRequest: OpenPullRequest;
}

function OpenPullRequestBadge({
  pullRequest,
}: OpenPullRequestBadgeProps): ReactNode {
  return (
    <Badge
      accent={pullRequest.isDraft ? "neutral" : "success"}
      variant="outlined"
    >
      {`#${String(pullRequest.number)}${pullRequest.isDraft ? " draft" : ""}`}
    </Badge>
  );
}

interface SettledPullRequestBadgeProps {
  pullRequest: BranchPullRequest;
}

function SettledPullRequestBadge({
  pullRequest,
}: SettledPullRequestBadgeProps): ReactNode {
  const mergedAccent = usePrStatusAccent("merged");
  const closedAccent = usePrStatusAccent("closed");
  const number = `#${String(pullRequest.number)}`;
  if (pullRequest.state === "MERGED") {
    return (
      <Badge accent={mergedAccent} variant="outlined">
        {`${number} merged`}
      </Badge>
    );
  }
  return (
    <Badge accent={closedAccent} variant="outlined">
      {`${number} closed`}
    </Badge>
  );
}

interface WorktreeBadgesProps {
  worktree: CheckoutWorktree;
}

function WorktreeBadges({ worktree }: WorktreeBadgesProps): ReactNode {
  return (
    <>
      {worktree.main ? (
        <Badge accent="neutral" variant="outlined">
          main
        </Badge>
      ) : null}
      {worktree.lock === null ? null : (
        <Badge accent="warning" variant="outlined">
          locked
        </Badge>
      )}
    </>
  );
}

interface WorktreeStatusLineProps {
  /** undefined while the statuses are read; null when git could not read it */
  status: CheckoutStatus | null | undefined;
}

function WorktreeStatusLine({ status }: WorktreeStatusLineProps): ReactNode {
  const text = ((): string => {
    if (status === undefined) return "reading status…";
    if (status === null) return "status unreadable";
    const parts = checkoutSummaryParts(status);
    return parts.length === 0 ? "clean, up to date" : parts.join(" · ");
  })();
  return (
    <Text className="text-xs text-muted" numberOfLines={1}>
      {text}
    </Text>
  );
}

interface WorktreeItemProps {
  worktree: CheckoutWorktree;
  status: CheckoutStatus | null | undefined;
  pullRequest: OpenPullRequest | null;
  selected: boolean;
  onSelect: (worktree: CheckoutWorktree) => void;
}

/** A worktree whose directory is gone opens nothing: git would prune it. */
function WorktreeItem({
  worktree,
  status,
  pullRequest,
  selected,
  onSelect,
}: WorktreeItemProps): ReactNode {
  const branchLine = (
    <View className="flex-row flex-wrap items-center gap-xs">
      <Icon icon={<GitBranchRegularIcon />} size={14} />
      <Code className="text-sm">{worktree.branch ?? "detached HEAD"}</Code>
      <WorktreeBadges worktree={worktree} />
      {pullRequest === null ? null : (
        <OpenPullRequestBadge pullRequest={pullRequest} />
      )}
    </View>
  );
  const folderLine = (
    <Text className="font-mono text-xs text-muted" numberOfLines={1}>
      {folderName(worktree.path)}
    </Text>
  );

  if (worktree.prunable) {
    return (
      <View className="gap-xxs px-sm py-xs opacity-60">
        {branchLine}
        <Text className="text-xs text-muted">directory gone</Text>
        {folderLine}
      </View>
    );
  }
  return (
    <SidebarRow
      selected={selected}
      aria-label={`Open the checkout of ${worktree.branch ?? "a detached HEAD"} at ${worktree.path}`}
      onPress={() => {
        onSelect(worktree);
      }}
    >
      {branchLine}
      <WorktreeStatusLine status={status} />
      {folderLine}
    </SidebarRow>
  );
}

interface BranchItemProps {
  branch: CheckoutBranch;
  pullRequest: OpenPullRequest | null;
  settledPullRequest: BranchPullRequest | null;
  selected: boolean;
  onSelect: (branch: string) => void;
}

function BranchItem({
  branch,
  pullRequest,
  settledPullRequest,
  selected,
  onSelect,
}: BranchItemProps): ReactNode {
  const track = branchTrackParts(branch);
  const details = [
    ...track,
    formatRelativeDate(branch.lastCommit.committedAt),
  ].join(" · ");
  return (
    <SidebarRow
      selected={selected}
      aria-label={`Open the branch ${branch.name}`}
      onPress={() => {
        onSelect(branch.name);
      }}
    >
      <View className="flex-row flex-wrap items-center gap-xs">
        <Code className="text-sm">{branch.name}</Code>
        {pullRequest === null ? null : (
          <OpenPullRequestBadge pullRequest={pullRequest} />
        )}
        {pullRequest === null && settledPullRequest !== null ? (
          <SettledPullRequestBadge pullRequest={settledPullRequest} />
        ) : null}
        {branch.merged ? (
          <Badge accent="success" variant="outlined">
            merged
          </Badge>
        ) : null}
        {branch.upstreamGone ? (
          <Badge accent="warning" variant="outlined">
            upstream gone
          </Badge>
        ) : null}
      </View>
      <Text className="text-xs text-muted" numberOfLines={1}>
        {details}
      </Text>
    </SidebarRow>
  );
}

interface BranchListProps {
  ownerRepo: string;
  branches: CheckoutBranch[];
  pullRequests: OpenPullRequest[];
  settledPullRequests: SettledBranchPullRequest[];
  selectedBranch: string | null;
  onSelectBranch: (branch: string) => void;
}

function BranchList({
  ownerRepo,
  branches,
  pullRequests,
  settledPullRequests,
  selectedBranch,
  onSelectBranch,
}: BranchListProps): ReactNode {
  return (
    <View className="gap-xxs">
      {branches.map((branch) => (
        <BranchItem
          key={branch.name}
          branch={branch}
          pullRequest={pullRequestOfBranch(
            pullRequests,
            ownerRepo,
            branch.name,
          )}
          settledPullRequest={
            settledPullRequests.find(
              (settled) => settled.branch === branch.name,
            )?.pullRequest ?? null
          }
          selected={selectedBranch === branch.name}
          onSelect={onSelectBranch}
        />
      ))}
    </View>
  );
}

/**
 * Nothing is lost by deleting it: its commits are in the base, its remote
 * branch was deleted (as GitHub does after a merge), or its pull request is
 * settled.
 */
const isSpent = (
  branch: CheckoutBranch,
  settledPullRequests: SettledBranchPullRequest[],
): boolean =>
  branch.merged ||
  branch.upstreamGone ||
  settledPullRequests.some((settled) => settled.branch === branch.name);

interface BranchesSectionProps {
  ownerRepo: string;
  /** the local branches no openable worktree has out */
  branches: CheckoutBranch[];
  pullRequests: OpenPullRequest[];
  settledPullRequests: SettledBranchPullRequest[];
  selectedBranch: string | null;
  onSelectBranch: (branch: string) => void;
}

/** The branches still in progress; the spent ones have their own section, to be cleaned up. */
function BranchesSection({
  ownerRepo,
  branches,
  pullRequests,
  settledPullRequests,
  selectedBranch,
  onSelectBranch,
}: BranchesSectionProps): ReactNode {
  const [showsAll, setShowsAll] = useState(false);
  const shown = showsAll ? branches : branches.slice(0, shownBranches);

  return (
    <View className="gap-xs">
      <SectionTitle icon={<GitBranchRegularIcon />}>
        {`Branches (${String(branches.length)})`}
      </SectionTitle>
      {branches.length === 0 ? (
        <Text className="px-sm text-sm text-muted">
          No branch in progress outside the worktrees.
        </Text>
      ) : null}
      <BranchList
        ownerRepo={ownerRepo}
        branches={shown}
        pullRequests={pullRequests}
        settledPullRequests={settledPullRequests}
        selectedBranch={selectedBranch}
        onSelectBranch={onSelectBranch}
      />
      {shown.length < branches.length ? (
        <View className="flex-row">
          <Button
            text={`Show the ${pluralOf(branches.length - shown.length, "older branch", "older branches")}`}
            accent="neutral"
            variant="soft"
            size="sm"
            onPress={() => {
              setShowsAll(true);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

/** Spent branches, all shown: they are listed to be deleted. */
function CleanupSection({
  ownerRepo,
  branches,
  pullRequests,
  settledPullRequests,
  selectedBranch,
  onSelectBranch,
}: BranchesSectionProps): ReactNode {
  if (branches.length === 0) return null;
  return (
    <View className="gap-xs">
      <SectionTitle icon={<BroomRegularIcon />}>
        {`To clean up (${String(branches.length)})`}
      </SectionTitle>
      <Text className="px-sm text-xs text-muted">
        Merged into the base, upstream deleted, or pull request merged or
        closed.
      </Text>
      <BranchList
        ownerRepo={ownerRepo}
        branches={branches}
        pullRequests={pullRequests}
        settledPullRequests={settledPullRequests}
        selectedBranch={selectedBranch}
        onSelectBranch={onSelectBranch}
      />
    </View>
  );
}

/** A fork's head is named with its owner, as GitHub does. */
const headLabel = (ownerRepo: string, pullRequest: OpenPullRequest): string => {
  const headOwner = pullRequest.headOwnerRepo?.split("/")[0] ?? null;
  const owner = ownerRepo.split("/")[0] ?? "";
  if (headOwner === null || headOwner.toLowerCase() === owner.toLowerCase()) {
    return pullRequest.headRefName;
  }
  return `${headOwner}:${pullRequest.headRefName}`;
};

interface PullRequestItemProps {
  ownerRepo: string;
  pullRequest: OpenPullRequest;
  selected: boolean;
  onOpen: (number: number) => void;
}

function PullRequestItem({
  ownerRepo,
  pullRequest,
  selected,
  onOpen,
}: PullRequestItemProps): ReactNode {
  return (
    <SidebarRow
      selected={selected}
      aria-label={`Open pull request #${String(pullRequest.number)}: ${pullRequest.title}`}
      onPress={() => {
        onOpen(pullRequest.number);
      }}
    >
      <View className="flex-row items-center gap-xs">
        <OpenPullRequestBadge pullRequest={pullRequest} />
        <Text className="min-w-0 flex-1 text-sm" numberOfLines={1}>
          {pullRequest.title}
        </Text>
      </View>
      <Text className="font-mono text-xs text-muted" numberOfLines={1}>
        {`${headLabel(ownerRepo, pullRequest)} · ${pullRequest.author ?? "ghost"} · ${formatRelativeDate(pullRequest.updatedAt)}`}
      </Text>
    </SidebarRow>
  );
}

interface PullRequestsSectionProps {
  ownerRepo: string;
  pulls: CheckoutRead<OpenPullRequestsResponse>;
  branches: CheckoutBranch[];
  selectedPullRequest: number | null;
  onOpenPullRequest: (number: number) => void;
}

/** The open pull requests no local branch carries: the others show on their branch. */
function PullRequestsSection({
  ownerRepo,
  pulls,
  branches,
  selectedPullRequest,
  onOpenPullRequest,
}: PullRequestsSectionProps): ReactNode {
  const without =
    pulls.value === null
      ? []
      : pullRequestsWithoutBranch(
          pulls.value.pullRequests,
          ownerRepo,
          branches,
        );
  const unlisted =
    pulls.value === null
      ? 0
      : pulls.value.totalCount - pulls.value.pullRequests.length;

  return (
    <View className="gap-xs">
      <SectionTitle icon={<GitPullRequestRegularIcon />}>
        Pull requests without a local branch
      </SectionTitle>
      {pulls.error === null ? null : (
        <WarningMessage>
          {`Could not read the open pull requests: ${pulls.error}`}
        </WarningMessage>
      )}
      {pulls.value === null && pulls.error === null ? <Loading /> : null}
      {pulls.value !== null && without.length === 0 ? (
        <Text className="px-sm text-sm text-muted">
          Every open pull request has its branch here.
        </Text>
      ) : null}
      <View className="gap-xxs">
        {without.map((pullRequest) => (
          <PullRequestItem
            key={pullRequest.number}
            ownerRepo={ownerRepo}
            pullRequest={pullRequest}
            selected={selectedPullRequest === pullRequest.number}
            onOpen={onOpenPullRequest}
          />
        ))}
      </View>
      {unlisted > 0 ? (
        <Text className="px-sm text-xs text-muted">
          {`${pluralOf(unlisted, "older pull request")} not listed`}
        </Text>
      ) : null}
    </View>
  );
}

interface WorktreesSectionProps {
  overview: CheckoutBranchesResponse;
  /** null while they are read */
  statuses: CheckoutWorktreeStatus[] | null;
  pullRequests: OpenPullRequest[];
  ownerRepo: string;
  selectedPath: string | null;
  onSelectWorktree: (worktree: CheckoutWorktree) => void;
}

function WorktreesSection({
  overview,
  statuses,
  pullRequests,
  ownerRepo,
  selectedPath,
  onSelectWorktree,
}: WorktreesSectionProps): ReactNode {
  const statusOf = (path: string): CheckoutStatus | null | undefined => {
    if (statuses === null) return undefined;
    return statuses.find((entry) => entry.path === path)?.status ?? null;
  };
  return (
    <View className="gap-xs">
      <SectionTitle icon={<FolderSimpleRegularIcon />}>
        {`Worktrees (${String(overview.worktrees.length)})`}
      </SectionTitle>
      {overview.worktrees.length === 0 ? (
        <Text className="px-sm text-sm text-muted">
          This repository is bare: no checkout has its files.
        </Text>
      ) : null}
      <View className="gap-xxs">
        {overview.worktrees.map((worktree) => (
          <WorktreeItem
            key={worktree.path}
            worktree={worktree}
            status={statusOf(worktree.path)}
            pullRequest={
              worktree.branch === null
                ? null
                : pullRequestOfBranch(pullRequests, ownerRepo, worktree.branch)
            }
            selected={selectedPath === worktree.path}
            onSelect={onSelectWorktree}
          />
        ))}
      </View>
    </View>
  );
}

export interface RepoSidebarProps {
  ownerRepo: string;
  /** the local branches and the worktrees, from git */
  branches: CheckoutRead<CheckoutBranchesResponse>;
  /** what each worktree holds, read after the branches; null while it is read */
  worktreeStatuses: CheckoutWorktreeStatus[] | null;
  /** the open pull requests, from GitHub: a failure only loses their badges */
  pulls: CheckoutRead<OpenPullRequestsResponse>;
  /** the merged or closed pull request of local branches, e.g. from reviewflow */
  settledPullRequests?: SettledBranchPullRequest[];
  selection: RepoSelection | null;
  /** the pull request open beside the sidebar, if any */
  selectedPullRequest?: number | null;
  onSelectWorktree: (worktree: CheckoutWorktree) => void;
  /** a local branch no worktree has out, read from the listed checkout */
  onSelectBranch: (branch: string) => void;
  onOpenPullRequest: (number: number) => void;
  onReload: () => void;
  /** before the title, e.g. a back button */
  headerStart?: ReactNode;
  /** under the title, e.g. what the last removal left behind */
  notices?: ReactNode;
}

/**
 * A repository as the disk has it, for picking what to work on: its
 * worktrees, the local branches no worktree has out (the spent ones grouped
 * apart), and the open pull requests no local branch carries. Each row selects;
 * what changes the disk lives on the selected checkout.
 */
export function RepoSidebar({
  ownerRepo,
  branches,
  worktreeStatuses,
  pulls,
  settledPullRequests = [],
  selection,
  selectedPullRequest = null,
  onSelectWorktree,
  onSelectBranch,
  onOpenPullRequest,
  onReload,
  headerStart,
  notices,
}: RepoSidebarProps): ReactNode {
  const overview = branches.value;
  const pullRequests = pulls.value?.pullRequests ?? [];
  const body = ((): ReactNode => {
    if (overview === null) {
      return branches.error === null ? <Loading /> : null;
    }
    const openablePaths = new Set(
      overview.worktrees
        .filter(({ prunable }) => !prunable)
        .map(({ path }) => path),
    );
    const withoutWorktree = overview.branches.filter(
      ({ worktreePath }) =>
        worktreePath === null || !openablePaths.has(worktreePath),
    );
    const branchProps = {
      ownerRepo,
      pullRequests,
      settledPullRequests,
      selectedBranch: selection?.kind === "branch" ? selection.name : null,
      onSelectBranch,
    };
    return (
      <>
        <WorktreesSection
          overview={overview}
          statuses={worktreeStatuses}
          pullRequests={pullRequests}
          ownerRepo={ownerRepo}
          selectedPath={selection?.kind === "worktree" ? selection.path : null}
          onSelectWorktree={onSelectWorktree}
        />
        <BranchesSection
          branches={withoutWorktree.filter(
            (branch) => !isSpent(branch, settledPullRequests),
          )}
          {...branchProps}
        />
        <CleanupSection
          branches={withoutWorktree.filter((branch) =>
            isSpent(branch, settledPullRequests),
          )}
          {...branchProps}
        />
        <PullRequestsSection
          ownerRepo={ownerRepo}
          pulls={pulls}
          branches={overview.branches}
          selectedPullRequest={selectedPullRequest}
          onOpenPullRequest={onOpenPullRequest}
        />
      </>
    );
  })();

  return (
    <View className="gap-l">
      <View className="flex-row items-center gap-sm">
        {headerStart}
        <Text
          role="heading"
          aria-level={1}
          className="min-w-0 flex-1 font-heading-extrabold text-xl"
          numberOfLines={1}
        >
          {ownerRepo}
        </Text>
        <TooltipIconButton
          icon={<ArrowsClockwiseRegularIcon />}
          size="sm"
          variant="soft"
          accent="neutral"
          aria-label="Read the repository again"
          disabledReason={branches.loading || pulls.loading ? "Reading…" : null}
          onPress={onReload}
        />
      </View>
      {notices}
      {branches.error === null ? null : (
        <WarningMessage>{branches.error}</WarningMessage>
      )}
      {body}
    </View>
  );
}
