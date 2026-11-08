import type {
  CheckoutCommitsResponse,
  CheckoutSyncResponse,
  DiffWhitespace,
} from "@reviewflow/sdk";
import type { CheckoutRead, CheckoutTab } from "@reviewflow/ui";
import {
  CheckoutSyncButtons,
  CheckoutView,
  DiffSettingsProvider,
} from "@reviewflow/ui";
import type { UseQueryResult } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorMessage, IconButton, View, WarningMessage } from "alouette";
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
  syncRepo,
  useCommitDiff,
  useRepoCommits,
  useRepoDiff,
  useRepoStatus,
} from "#/services/reposApi.ts";

const first = (value: string[] | string | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

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

interface RepoCheckoutProps {
  checkout: CheckoutRef;
  initialWhitespace: DiffWhitespace;
  back: ReactNode;
}

function RepoCheckout({
  checkout,
  initialWhitespace,
  back,
}: RepoCheckoutProps): ReactNode {
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

  const uncommitted = useRepoDiff({
    checkout,
    scope: "uncommitted",
    whitespace,
    enabled: tab === "uncommitted",
  });
  const branch = useRepoDiff({
    checkout,
    scope: "committed",
    whitespace,
    enabled: tab === "branch",
  });
  const commitDiff = useCommitDiff({
    checkout,
    sha: tab === "history" ? openSha : null,
    whitespace,
  });
  const status = fetchedStatus.data?.status ?? localStatus.data?.status ?? null;

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
      whitespace={whitespace}
      headerStart={back}
      headerEnd={
        <>
          <BranchPullRequests
            ownerRepo={checkout.ownerRepo}
            branch={status?.branch ?? null}
          />
          <RepoSyncButtons checkout={checkout} />
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

/**
 * One checkout, the listed one or one of its worktrees: what is uncommitted,
 * its branch against the default branch, its history.
 */
export default function CheckoutPage(): ReactNode {
  const router = useRouter();
  const params = useLocalSearchParams<{ repo?: string; worktree?: string }>();
  const ownerRepo = first(params.repo) ?? "";
  const worktree = first(params.worktree) ?? null;
  const valid = /^[^/\s]+\/[^/\s]+$/.test(ownerRepo);
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
          This address is not a repository: it needs ?repo=owner/repo.
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
        <RepoCheckout
          // another checkout is another screen: its tab and open commit start over
          key={`${ownerRepo}\n${worktree ?? ""}`}
          checkout={{ ownerRepo, worktree }}
          initialWhitespace={settings.hideWhitespace ? "hide" : "show"}
          back={back}
        />
      </DiffSettingsProvider>
    </View>
  );
}
