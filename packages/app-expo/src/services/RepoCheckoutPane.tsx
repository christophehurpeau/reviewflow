import type {
  CheckoutCommitsResponse,
  CheckoutSyncResponse,
  DiffWhitespace,
} from "@reviewflow/sdk";
import type { CheckoutRead, CheckoutTab } from "@reviewflow/ui";
import { CheckoutSyncButtons, CheckoutView } from "@reviewflow/ui";
import type { UseQueryResult } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { WarningMessage } from "alouette";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  BranchPullRequests,
  BranchPullRequestsNotice,
} from "#/services/BranchPullRequests.tsx";
import {
  saveRepoFile,
  useRepoFile,
  useRepoFileAtHead,
  useRepoFiles,
} from "#/services/filesApi.ts";
import type { CheckoutRef } from "#/services/reposApi.ts";
import {
  invalidateBranchPulls,
  invalidateRepo,
  syncRepo,
  useCommitDiff,
  useRepoCommits,
  useRepoDiff,
  useRepoStatus,
} from "#/services/reposApi.ts";

const readOf = <Value,>(query: UseQueryResult<Value>): CheckoutRead<Value> => ({
  value: query.data ?? null,
  error: query.error?.message ?? null,
  loading: query.isFetching,
});

/**
 * Where the work is: what is uncommitted, else the branch's own commits, else
 * the history. Null until the status and the commits have answered.
 */
const firstTabOf = (
  status: UseQueryResult<CheckoutSyncResponse>,
  commits: UseQueryResult<CheckoutCommitsResponse>,
): CheckoutTab | null => {
  if (status.isPending || commits.isPending) return null;
  const read = status.data?.status;
  if (read !== undefined && read.modified + read.untracked > 0) {
    return "uncommitted";
  }
  if ((commits.data?.onBranchCount ?? 0) > 0) return "branch";
  return "history";
};

interface RepoSyncProps {
  checkout: CheckoutRef;
}

/** Pull and Push, shown once the status (fetched first) says they apply. */
function RepoSyncButtons({ checkout }: RepoSyncProps): ReactNode {
  const client = useQueryClient();
  const { data } = useRepoStatus(checkout, "fetched");
  if (data === undefined) return null;
  return (
    <CheckoutSyncButtons
      status={data.status}
      hasOrigin={data.hasOrigin}
      name={checkout.worktree ?? checkout.ownerRepo}
      onPull={() => syncRepo("pull", checkout)}
      onPush={() => syncRepo("push", checkout)}
      onDone={() => {
        invalidateRepo(client, checkout.ownerRepo).catch(() => undefined);
      }}
    />
  );
}

/** A failed fetch degrades: the counts are then as of the previous one, and it says so. */
function RepoSyncNotice({ checkout }: RepoSyncProps): ReactNode {
  const { data, error } = useRepoStatus(checkout, "fetched");
  const problem = error?.message ?? data?.fetchError ?? null;
  if (problem === null) return null;
  return <WarningMessage>{`Could not fetch: ${problem}`}</WarningMessage>;
}

interface RepoCheckoutPaneProps {
  checkout: CheckoutRef;
  initialWhitespace: DiffWhitespace;
  /** before the title, e.g. a back button on a narrow screen */
  headerStart?: ReactNode;
  /** opens one of the branch's pull requests in place; its own screen unless set */
  onOpenPullRequest?: (number: number) => void;
  /** after pull and push, e.g. the worktree's removal */
  headerExtra?: ReactNode;
}

/**
 * One checkout, the listed one or one of its worktrees: what is uncommitted,
 * its branch against the default branch, its history and its files.
 */
export function RepoCheckoutPane({
  checkout,
  initialWhitespace,
  headerStart,
  headerExtra,
  onOpenPullRequest,
}: RepoCheckoutPaneProps): ReactNode {
  const client = useQueryClient();
  const [chosenTab, setChosenTab] = useState<CheckoutTab | null>(null);
  const [openSha, setOpenSha] = useState<string | null>(null);
  const [whitespace, setWhitespace] = useState(initialWhitespace);
  const localStatus = useRepoStatus(checkout, "local");
  const fetchedStatus = useRepoStatus(checkout, "fetched");
  const commits = useRepoCommits(checkout);

  // decided once: a reload after a commit must not move the reader to another tab
  const tab = chosenTab ?? firstTabOf(localStatus, commits);
  if (chosenTab === null && tab !== null) setChosenTab(tab);

  // every tab is read with the screen, whichever opens first: switching to one
  // shows its answer at once instead of starting a git read then
  const uncommitted = useRepoDiff({
    checkout,
    scope: "uncommitted",
    whitespace,
    enabled: true,
  });
  const branch = useRepoDiff({
    checkout,
    scope: "committed",
    whitespace,
    enabled: true,
  });
  const commitDiff = useCommitDiff({
    checkout,
    sha: tab === "history" ? openSha : null,
    whitespace,
  });
  const status = fetchedStatus.data?.status ?? localStatus.data?.status ?? null;

  const [openPath, setOpenPath] = useState<string | null>(null);
  const files = useRepoFiles(checkout, true);
  const openFile = useRepoFile(checkout, tab === "files" ? openPath : null);
  // read with the file, so switching to its diff shows at once
  const openFileAtHead = useRepoFileAtHead(
    checkout,
    tab === "files" ? openPath : null,
  );

  return (
    <CheckoutView
      title={checkout.ownerRepo}
      status={status}
      tab={tab}
      diff={readOf(tab === "branch" ? branch : uncommitted)}
      history={{
        commits: readOf(commits),
        openSha,
        diff: readOf(commitDiff),
        onOpenChange: setOpenSha,
      }}
      files={{
        paths: readOf(files),
        selectedPath: openPath,
        onSelect: setOpenPath,
        file: readOf(openFile),
        onSave: (path, source, expectedSource) =>
          saveRepoFile(client, checkout, path, source, expectedSource),
        fileAtHead: readOf(openFileAtHead),
      }}
      whitespace={whitespace}
      headerStart={headerStart}
      headerEnd={
        <>
          <BranchPullRequests
            ownerRepo={checkout.ownerRepo}
            branch={status?.branch ?? null}
            onOpen={onOpenPullRequest}
          />
          <RepoSyncButtons checkout={checkout} />
          {headerExtra}
        </>
      }
      notices={
        <>
          <RepoSyncNotice checkout={checkout} />
          <BranchPullRequestsNotice
            ownerRepo={checkout.ownerRepo}
            branch={status?.branch ?? null}
          />
        </>
      }
      onReload={() => {
        // a failed read is the query's error, shown in place
        invalidateRepo(client, checkout.ownerRepo).catch(() => undefined);
        client
          .invalidateQueries({ queryKey: ["repoFiles", checkout.ownerRepo] })
          .catch(() => undefined);
        invalidateBranchPulls(client, checkout.ownerRepo).catch(
          () => undefined,
        );
      }}
      onTabChange={setChosenTab}
      onWhitespaceToggle={() => {
        setWhitespace(whitespace === "show" ? "hide" : "show");
      }}
    />
  );
}
