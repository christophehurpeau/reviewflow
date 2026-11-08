import type {
  CheckoutBranch,
  CheckoutStatus,
  DiffWhitespace,
} from "@reviewflow/sdk";
import type { CheckoutRead, CheckoutTab } from "@reviewflow/ui";
import { CheckoutView, DiffSettingsProvider } from "@reviewflow/ui";
import type { UseQueryResult } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorMessage, IconButton, View } from "alouette";
import { ArrowLeftRegularIcon } from "alouette-icons/phosphor-icons/ArrowLeft";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  BranchPullRequests,
  BranchPullRequestsNotice,
} from "#/services/BranchPullRequests.tsx";
import { useDiffPreferences } from "#/services/DiffPreferencesProvider.tsx";
import type { CheckoutRef } from "#/services/reposApi.ts";
import {
  invalidateBranchPulls,
  invalidateRepo,
  useCommitDiff,
  useRepoBranches,
  useRepoCommits,
  useRepoDiff,
} from "#/services/reposApi.ts";

const first = (value: string[] | string | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

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

interface RepoBranchProps {
  ownerRepo: string;
  branchName: string;
  initialWhitespace: DiffWhitespace;
  back: ReactNode;
}

function RepoBranch({
  ownerRepo,
  branchName,
  initialWhitespace,
  back,
}: RepoBranchProps): ReactNode {
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
      headerStart={back}
      headerEnd={
        <BranchPullRequests ownerRepo={ownerRepo} branch={branchName} />
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

/**
 * A local branch no worktree has out, read from the listed checkout: its
 * commits since it left the default branch, its history, and its pull
 * requests, merged and closed ones included.
 */
export default function BranchPage(): ReactNode {
  const router = useRouter();
  const params = useLocalSearchParams<{ repo?: string; branch?: string }>();
  const ownerRepo = first(params.repo) ?? "";
  const branchName = first(params.branch) ?? "";
  const valid = /^[^/\s]+\/[^/\s]+$/.test(ownerRepo) && branchName !== "";
  const { settings, loaded } = useDiffPreferences();

  const back = (
    <IconButton
      icon={<ArrowLeftRegularIcon />}
      size="sm"
      aria-label={`Back to ${ownerRepo}`}
      onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace({ pathname: "/repo", params: { repo: ownerRepo } });
      }}
    />
  );

  if (!valid) {
    return (
      <View className="mx-auto w-full max-w-[1200px] gap-m px-l pt-l">
        <View className="flex-row">{back}</View>
        <ErrorMessage>
          This address is not a branch: it needs ?repo=owner/repo&branch=name.
        </ErrorMessage>
      </View>
    );
  }
  // the whitespace preference is read once, when the screen mounts
  if (!loaded) return null;

  return (
    <View className="mx-auto min-h-0 w-full max-w-[1800px] flex-1">
      <DiffSettingsProvider
        theme={settings.theme}
        font={settings.font}
        customFont={settings.customFont}
        wordWrap={settings.wordWrap}
      >
        <RepoBranch
          // another branch is another screen: its tab and open commit start over
          key={`${ownerRepo}\n${branchName}`}
          ownerRepo={ownerRepo}
          branchName={branchName}
          initialWhitespace={settings.hideWhitespace ? "hide" : "show"}
          back={back}
        />
      </DiffSettingsProvider>
    </View>
  );
}
