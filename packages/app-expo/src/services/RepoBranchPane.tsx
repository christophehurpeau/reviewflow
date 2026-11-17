import type {
  CheckoutBranch,
  CheckoutStatus,
  DiffWhitespace,
} from "@reviewflow/sdk";
import type { CheckoutRead, CheckoutTab } from "@reviewflow/ui";
import { CheckoutView } from "@reviewflow/ui";
import type { UseQueryResult } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  BranchPullRequests,
  BranchPullRequestsNotice,
} from "#/services/BranchPullRequests.tsx";
import type { CheckoutRef } from "#/services/reposApi.ts";
import {
  invalidateBranchPulls,
  invalidateRepo,
  useCommitDiff,
  useRepoBranches,
  useRepoCommits,
  useRepoDiff,
} from "#/services/reposApi.ts";

const readOf = <Value,>(query: UseQueryResult<Value>): CheckoutRead<Value> => ({
  value: query.data ?? null,
  error: query.error?.message ?? null,
  loading: query.isFetching,
});

/** A branch no worktree has out: nothing uncommitted to show. */
const branchTabs: CheckoutTab[] = ["branch", "history"];

/**
 * The header's status for a branch read from the listed checkout, at `path`:
 * it has no working tree, so nothing is modified or untracked.
 */
const statusOfBranch = (
  branch: CheckoutBranch,
  path: string,
): CheckoutStatus => ({
  path,
  branch: branch.name,
  commit: {
    shortSha: branch.sha.slice(0, 7),
    subject: branch.lastCommit.subject,
    committedAt: branch.lastCommit.committedAt,
  },
  upstream: branch.upstream,
  ahead: branch.ahead,
  behind: branch.behind,
  modified: 0,
  untracked: 0,
});

interface RepoBranchPaneProps {
  ownerRepo: string;
  branchName: string;
  initialWhitespace: DiffWhitespace;
  /** before the title, e.g. a back button on a narrow screen */
  headerStart?: ReactNode;
  /** opens one of the branch's pull requests in place; its own screen unless set */
  onOpenPullRequest?: (number: number) => void;
}

/**
 * A local branch no worktree has out, read from the listed checkout: its
 * commits since it left the default branch, its history, and its pull
 * requests, merged and closed ones included.
 */
export function RepoBranchPane({
  ownerRepo,
  branchName,
  initialWhitespace,
  headerStart,
  onOpenPullRequest,
}: RepoBranchPaneProps): ReactNode {
  const client = useQueryClient();
  const [tab, setTab] = useState<CheckoutTab>("branch");
  const [openSha, setOpenSha] = useState<string | null>(null);
  const [whitespace, setWhitespace] = useState(initialWhitespace);
  const listed: CheckoutRef = { ownerRepo, worktree: null };
  const checkout: CheckoutRef = { ...listed, branch: branchName };
  const branches = useRepoBranches(ownerRepo);
  const commits = useRepoCommits(checkout);
  const diff = useRepoDiff({
    checkout,
    scope: "committed",
    whitespace,
    enabled: tab === "branch",
  });
  // a commit is the same whichever branch reaches it: read from the listed checkout
  const commitDiff = useCommitDiff({
    checkout: listed,
    sha: tab === "history" ? openSha : null,
    whitespace,
  });

  const branch =
    branches.data?.branches.find(({ name }) => name === branchName) ?? null;
  const mainPath =
    branches.data?.worktrees.find(({ main }) => main)?.path ?? null;
  const status =
    branch === null || mainPath === null
      ? null
      : statusOfBranch(branch, mainPath);

  return (
    <CheckoutView
      title={ownerRepo}
      status={status}
      tab={tab}
      tabs={branchTabs}
      diff={readOf(diff)}
      history={{
        commits: readOf(commits),
        openSha,
        diff: readOf(commitDiff),
        onOpenChange: setOpenSha,
      }}
      whitespace={whitespace}
      headerStart={headerStart}
      headerEnd={
        <BranchPullRequests
          ownerRepo={ownerRepo}
          branch={branchName}
          onOpen={onOpenPullRequest}
        />
      }
      notices={
        <BranchPullRequestsNotice ownerRepo={ownerRepo} branch={branchName} />
      }
      onReload={() => {
        // a failed read is the query's error, shown in place
        invalidateRepo(client, ownerRepo).catch(() => undefined);
        invalidateBranchPulls(client, ownerRepo).catch(() => undefined);
      }}
      onTabChange={setTab}
      onWhitespaceToggle={() => {
        setWhitespace(whitespace === "show" ? "hide" : "show");
      }}
    />
  );
}
