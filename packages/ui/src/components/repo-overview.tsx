import type {
  CheckoutBranch,
  CheckoutBranchesResponse,
  CheckoutWorktree,
  OpenPullRequest,
  OpenPullRequestsResponse,
} from "@reviewflow/sdk";
import {
  formatRelativeDate,
  pluralOf,
  pullRefusal,
  pullRequestOfBranch,
  pullRequestsWithoutBranch,
} from "@reviewflow/sdk";
import {
  ActionButton,
  Badge,
  Box,
  Button,
  Code,
  EmptyState,
  Icon,
  IndeterminateCircularProgress,
  PressableListItem,
  SectionTitle,
  Text,
  View,
  WarningMessage,
} from "alouette";
import { ArrowsClockwiseRegularIcon } from "alouette-icons/phosphor-icons/ArrowsClockwise";
import { CloudArrowDownRegularIcon } from "alouette-icons/phosphor-icons/CloudArrowDown";
import { FolderSimpleRegularIcon } from "alouette-icons/phosphor-icons/FolderSimple";
import { GitBranchRegularIcon } from "alouette-icons/phosphor-icons/GitBranch";
import { GitPullRequestRegularIcon } from "alouette-icons/phosphor-icons/GitPullRequest";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  PullRequestMetaSeparator,
  PullRequestRowFrame,
} from "../board/pull-request-row.tsx";
import {
  branchTrackParts,
  checkoutSummaryParts,
} from "../services/checkoutSummary.ts";
import { errorToMessage } from "../services/errorToMessage.ts";
import type { CheckoutRead } from "./checkout-view.tsx";
import { TooltipIconButton } from "./tooltip-icon-button.tsx";

/** Past this many, the older branches wait behind a press. */
const shownBranches = 20;

const joinParts = (parts: string[], whenEmpty: string): string =>
  parts.length === 0 ? whenEmpty : parts.join(" · ");

function Loading(): ReactNode {
  return (
    <View className="items-center py-l">
      <IndeterminateCircularProgress loading />
    </View>
  );
}

interface WorktreeRowProps {
  worktree: CheckoutWorktree;
  onOpen: (worktree: CheckoutWorktree) => void;
  /** at the row's bottom, e.g. a removal; each takes its own press */
  actions: ReactNode;
}

function WorktreeSummary({ worktree }: Pick<WorktreeRowProps, "worktree">) {
  if (worktree.status === null) {
    return <Text className="text-sm text-muted">status unreadable</Text>;
  }
  return (
    <Text className="text-sm text-muted">
      {joinParts(checkoutSummaryParts(worktree.status), "clean, up to date")}
    </Text>
  );
}

function WorktreeBadges({ worktree }: Pick<WorktreeRowProps, "worktree">) {
  return (
    <>
      {worktree.main ? (
        <Badge accent="neutral" variant="outlined">
          main checkout
        </Badge>
      ) : null}
      {worktree.lock === null ? null : (
        <Badge accent="warning" variant="outlined">
          locked
        </Badge>
      )}
      {worktree.prunable ? (
        <Badge accent="warning" variant="outlined">
          directory gone
        </Badge>
      ) : null}
    </>
  );
}

function WorktreeContent({ worktree }: Pick<WorktreeRowProps, "worktree">) {
  return (
    <View className="gap-xxs">
      <View className="flex-row flex-wrap items-center gap-sm">
        <View className="flex-row items-center gap-xxs">
          <Icon icon={<GitBranchRegularIcon />} size={14} />
          <Code className="text-sm">{worktree.branch ?? "detached HEAD"}</Code>
        </View>
        <WorktreeBadges worktree={worktree} />
        {worktree.prunable ? null : <WorktreeSummary worktree={worktree} />}
      </View>
      <Text className="font-mono text-xs text-muted">{worktree.path}</Text>
    </View>
  );
}

/**
 * The row opens the checkout; its actions sit at the bottom and take their own
 * press. A worktree whose directory is gone opens nothing: git would prune it.
 */
function WorktreeRow({
  worktree,
  onOpen,
  actions,
}: WorktreeRowProps): ReactNode {
  if (worktree.prunable) {
    return (
      <Box className="surface px-m py-sm">
        <WorktreeContent worktree={worktree} />
      </Box>
    );
  }
  return (
    <PressableListItem
      role="link"
      aria-label={`Open the checkout at ${worktree.path}`}
      actions={
        actions === null || actions === undefined ? undefined : (
          <View className="flex-row flex-wrap items-center gap-xs">
            {actions}
          </View>
        )
      }
      onPress={() => {
        onOpen(worktree);
      }}
    >
      <WorktreeContent worktree={worktree} />
    </PressableListItem>
  );
}

interface PullRequestButtonProps {
  pullRequest: OpenPullRequest;
  onOpen: (number: number) => void;
}

function PullRequestButton({
  pullRequest,
  onOpen,
}: PullRequestButtonProps): ReactNode {
  return (
    <Button
      text={`#${String(pullRequest.number)}`}
      icon={<GitPullRequestRegularIcon />}
      accent={pullRequest.isDraft ? "neutral" : "success"}
      variant="tonal"
      size="sm"
      role="link"
      aria-label={`Open pull request #${String(pullRequest.number)}: ${pullRequest.title}`}
      onPress={() => {
        onOpen(pullRequest.number);
      }}
    />
  );
}

interface BranchStateBadgesProps {
  branch: CheckoutBranch;
  worktree: CheckoutWorktree | null;
}

function BranchStateBadges({
  branch,
  worktree,
}: BranchStateBadgesProps): ReactNode {
  return (
    <>
      {worktree === null ? null : (
        <Badge accent="brand" variant="outlined">
          {worktree.main ? "current" : "checked out"}
        </Badge>
      )}
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
    </>
  );
}

interface BranchRowProps {
  branch: CheckoutBranch;
  pullRequest: OpenPullRequest | null;
  /** the worktree it is checked out in, openable; null when none */
  worktree: CheckoutWorktree | null;
  onOpenWorktree: (worktree: CheckoutWorktree) => void;
  onOpenBranch: (branch: string) => void;
  onPullWorktree: (worktree: CheckoutWorktree) => Promise<void>;
  onOpenPullRequest: (number: number) => void;
}

/**
 * Offered on the worktree's status by the rule the server applies before
 * pulling, so the button never meets a refusal of its own terms.
 */
const isPullable = (worktree: CheckoutWorktree | null): boolean =>
  worktree?.status != null && pullRefusal(worktree.status) === null;

/**
 * The row opens the branch: its checkout when a worktree has it out, else the
 * branch read from the listed checkout. Its pull and its pull request sit at
 * the bottom and take their own press.
 */
function BranchRow({
  branch,
  pullRequest,
  worktree,
  onOpenWorktree,
  onOpenBranch,
  onPullWorktree,
  onOpenPullRequest,
}: BranchRowProps): ReactNode {
  const track = branchTrackParts(branch);
  const pullable = worktree !== null && isPullable(worktree);
  const hasActions = pullable || pullRequest !== null;
  return (
    <PressableListItem
      role="link"
      aria-label={
        worktree === null
          ? `Open the branch ${branch.name}`
          : `Open the checkout of ${branch.name} at ${worktree.path}`
      }
      actions={
        hasActions ? (
          <View className="flex-row flex-wrap items-center gap-xs">
            {pullable ? (
              <ActionButton
                text={`Pull ${String(worktree.status?.behind)}`}
                icon={<CloudArrowDownRegularIcon />}
                accent="brand"
                variant="tonal"
                size="sm"
                aria-label={`Pull ${branch.name}`}
                errorMessageVariant="flat"
                errorToMessage={errorToMessage}
                onPress={() => onPullWorktree(worktree)}
              />
            ) : null}
            {pullRequest === null ? null : (
              <PullRequestButton
                pullRequest={pullRequest}
                onOpen={onOpenPullRequest}
              />
            )}
          </View>
        ) : undefined
      }
      onPress={() => {
        if (worktree === null) onOpenBranch(branch.name);
        else onOpenWorktree(worktree);
      }}
    >
      <View className="min-w-0 gap-xxs">
        <View className="flex-row flex-wrap items-center gap-sm">
          <Code className="text-sm">{branch.name}</Code>
          <BranchStateBadges branch={branch} worktree={worktree} />
          {track.length === 0 ? null : (
            <Text className="text-xs text-muted">{track.join(" · ")}</Text>
          )}
        </View>
        <Text className="text-xs text-muted" numberOfLines={1}>
          {`${branch.lastCommit.subject} · ${formatRelativeDate(branch.lastCommit.committedAt)}`}
        </Text>
      </View>
    </PressableListItem>
  );
}

interface BranchesSectionProps {
  ownerRepo: string;
  overview: CheckoutBranchesResponse;
  pullRequests: OpenPullRequest[];
  onOpenWorktree: (worktree: CheckoutWorktree) => void;
  onOpenBranch: (branch: string) => void;
  onPullWorktree: (worktree: CheckoutWorktree) => Promise<void>;
  onOpenPullRequest: (number: number) => void;
}

function BranchesSection({
  ownerRepo,
  overview,
  pullRequests,
  onOpenWorktree,
  onOpenBranch,
  onPullWorktree,
  onOpenPullRequest,
}: BranchesSectionProps): ReactNode {
  const [showsAll, setShowsAll] = useState(false);
  const { branches, worktrees } = overview;
  const shown = showsAll ? branches : branches.slice(0, shownBranches);
  const openableWorktree = (path: string | null): CheckoutWorktree | null =>
    worktrees.find(
      (worktree) => worktree.path === path && !worktree.prunable,
    ) ?? null;

  return (
    <View className="gap-sm">
      <SectionTitle icon={<GitBranchRegularIcon />}>
        {`Local branches (${String(branches.length)})`}
      </SectionTitle>
      {branches.length === 0 ? (
        <Text className="text-sm text-muted">No local branch.</Text>
      ) : (
        <View className="gap-xs">
          {shown.map((branch) => (
            <BranchRow
              key={branch.name}
              branch={branch}
              pullRequest={pullRequestOfBranch(
                pullRequests,
                ownerRepo,
                branch.name,
              )}
              worktree={openableWorktree(branch.worktreePath)}
              onOpenWorktree={onOpenWorktree}
              onOpenBranch={onOpenBranch}
              onPullWorktree={onPullWorktree}
              onOpenPullRequest={onOpenPullRequest}
            />
          ))}
        </View>
      )}
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

interface PullRequestRowProps {
  ownerRepo: string;
  pullRequest: OpenPullRequest;
  onOpen: (number: number) => void;
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

/** The board's row, without the repository its screen already names. */
function PullRequestRow({
  ownerRepo,
  pullRequest,
  onOpen,
}: PullRequestRowProps): ReactNode {
  return (
    <PullRequestRowFrame
      ariaLabel={`Open pull request #${String(pullRequest.number)}: ${pullRequest.title}`}
      meta={
        <>
          <Text className="font-mono text-xs text-muted">
            {`#${String(pullRequest.number)}`}
          </Text>
          <PullRequestMetaSeparator />
          <Text className="font-mono text-xs text-muted">
            {headLabel(ownerRepo, pullRequest)}
          </Text>
          <PullRequestMetaSeparator />
          <Text className="text-xs text-muted">
            {pullRequest.author ?? "ghost"}
          </Text>
          <PullRequestMetaSeparator />
          <Text className="text-xs text-muted">
            {`updated ${formatRelativeDate(pullRequest.updatedAt)}`}
          </Text>
        </>
      }
      title={pullRequest.title}
      titleAside={
        pullRequest.isDraft ? (
          <Badge accent="neutral" variant="outlined">
            draft
          </Badge>
        ) : null
      }
      onPress={() => {
        onOpen(pullRequest.number);
      }}
    />
  );
}

interface PullRequestsSectionProps {
  ownerRepo: string;
  pulls: CheckoutRead<OpenPullRequestsResponse>;
  branches: CheckoutBranch[];
  onOpenPullRequest: (number: number) => void;
}

/** The open pull requests no local branch carries: the way to the others is their branch's row. */
function PullRequestsSection({
  ownerRepo,
  pulls,
  branches,
  onOpenPullRequest,
}: PullRequestsSectionProps): ReactNode {
  const body = ((): ReactNode => {
    if (pulls.value === null) {
      if (pulls.error === null) return <Loading />;
      return null;
    }
    const without = pullRequestsWithoutBranch(
      pulls.value.pullRequests,
      ownerRepo,
      branches,
    );
    const unlisted = pulls.value.totalCount - pulls.value.pullRequests.length;
    return (
      <>
        {without.length === 0 ? (
          <Text className="text-sm text-muted">
            Every open pull request has its branch here.
          </Text>
        ) : (
          <View className="gap-xs">
            {without.map((pullRequest) => (
              <PullRequestRow
                key={pullRequest.number}
                ownerRepo={ownerRepo}
                pullRequest={pullRequest}
                onOpen={onOpenPullRequest}
              />
            ))}
          </View>
        )}
        {unlisted > 0 ? (
          <Text className="text-xs text-muted">
            {`${pluralOf(unlisted, "older pull request")} not listed`}
          </Text>
        ) : null}
      </>
    );
  })();

  return (
    <View className="gap-sm">
      <SectionTitle icon={<GitPullRequestRegularIcon />}>
        Open pull requests without a local branch
      </SectionTitle>
      {pulls.error === null ? null : (
        <WarningMessage>
          {`Could not read the open pull requests: ${pulls.error}`}
        </WarningMessage>
      )}
      {body}
    </View>
  );
}

export interface RepoOverviewProps {
  ownerRepo: string;
  /** the local branches and the worktrees, from git */
  branches: CheckoutRead<CheckoutBranchesResponse>;
  /** the open pull requests, from GitHub: a failure only loses the pull request buttons */
  pulls: CheckoutRead<OpenPullRequestsResponse>;
  onReload: () => void;
  onOpenWorktree: (worktree: CheckoutWorktree) => void;
  /** a local branch no worktree has out, read from the listed checkout */
  onOpenBranch: (branch: string) => void;
  /** a fast-forward pull in that worktree; a rejection is shown under its button */
  onPullWorktree: (worktree: CheckoutWorktree) => Promise<void>;
  onOpenPullRequest: (number: number) => void;
  /** before the title, e.g. a back button */
  headerStart?: ReactNode;
  /** under the title, e.g. what the last removal left behind */
  notices?: ReactNode;
  /** at the bottom of a worktree's row, e.g. its removal; each takes its own press */
  renderWorktreeActions?: (worktree: CheckoutWorktree) => ReactNode;
}

/**
 * A repository as the disk has it: its worktrees, each opening its checkout;
 * its local branches, with the open pull request of each and the worktree it
 * is checked out in; and the open pull requests no local branch carries.
 * Read-only: what changes the disk comes from the caller, through
 * `onPullWorktree` and `renderWorktreeActions`.
 */
export function RepoOverview({
  ownerRepo,
  branches,
  pulls,
  onReload,
  onOpenWorktree,
  onOpenBranch,
  onPullWorktree,
  onOpenPullRequest,
  headerStart,
  notices,
  renderWorktreeActions,
}: RepoOverviewProps): ReactNode {
  const overview = branches.value;
  const pullRequests = pulls.value?.pullRequests ?? [];

  const body = ((): ReactNode => {
    if (overview === null) {
      if (branches.error !== null) return null;
      return <Loading />;
    }
    return (
      <View className="gap-xl">
        <View className="gap-sm">
          <SectionTitle icon={<FolderSimpleRegularIcon />}>
            {`Worktrees (${String(overview.worktrees.length)})`}
          </SectionTitle>
          {overview.worktrees.length === 0 ? (
            <EmptyState icon={<FolderSimpleRegularIcon />} title="No worktree">
              This repository is bare: no checkout has its files.
            </EmptyState>
          ) : (
            <View className="gap-xs">
              {overview.worktrees.map((worktree) => (
                <WorktreeRow
                  key={worktree.path}
                  worktree={worktree}
                  actions={renderWorktreeActions?.(worktree)}
                  onOpen={onOpenWorktree}
                />
              ))}
            </View>
          )}
        </View>
        <BranchesSection
          ownerRepo={ownerRepo}
          overview={overview}
          pullRequests={pullRequests}
          onOpenWorktree={onOpenWorktree}
          onOpenBranch={onOpenBranch}
          onPullWorktree={onPullWorktree}
          onOpenPullRequest={onOpenPullRequest}
        />
        <PullRequestsSection
          ownerRepo={ownerRepo}
          pulls={pulls}
          branches={overview.branches}
          onOpenPullRequest={onOpenPullRequest}
        />
      </View>
    );
  })();

  return (
    <View className="gap-l">
      <View className="flex-row flex-wrap items-center gap-m">
        {headerStart}
        <Text
          role="heading"
          aria-level={1}
          className="min-w-0 flex-1 font-heading-extrabold text-3xl xl:text-4xl"
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
