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
import { useDiffPreferences } from "#/services/DiffPreferencesProvider.tsx";
import {
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
  ownerRepo: string;
}

/** Pull and Push, shown once the status (fetched first) says they apply. */
function RepoSyncButtons({ ownerRepo }: RepoSyncProps): ReactNode {
  const client = useQueryClient();
  const { data } = useRepoStatus(ownerRepo, "fetched");
  if (data === undefined) return null;
  return (
    <CheckoutSyncButtons
      status={data.status}
      hasOrigin={data.hasOrigin}
      name={ownerRepo}
      onPull={() => syncRepo("pull", ownerRepo)}
      onPush={() => syncRepo("push", ownerRepo)}
      onDone={() => {
        invalidateRepo(client, ownerRepo).catch(() => undefined);
      }}
    />
  );
}

/** A failed fetch degrades: the counts are then as of the previous one, and it says so. */
function RepoSyncNotice({ ownerRepo }: RepoSyncProps): ReactNode {
  const { data, error } = useRepoStatus(ownerRepo, "fetched");
  const problem = error?.message ?? data?.fetchError ?? null;
  if (problem === null) return null;
  return <WarningMessage>{`Could not fetch: ${problem}`}</WarningMessage>;
}

interface RepoCheckoutProps {
  ownerRepo: string;
  initialWhitespace: DiffWhitespace;
  back: ReactNode;
}

function RepoCheckout({
  ownerRepo,
  initialWhitespace,
  back,
}: RepoCheckoutProps): ReactNode {
  const client = useQueryClient();
  const [chosenTab, setChosenTab] = useState<CheckoutTab | null>(null);
  const [openSha, setOpenSha] = useState<string | null>(null);
  const [whitespace, setWhitespace] = useState(initialWhitespace);
  const localStatus = useRepoStatus(ownerRepo, "local");
  const fetchedStatus = useRepoStatus(ownerRepo, "fetched");
  const commits = useRepoCommits(ownerRepo);

  // decided once: a reload after a commit must not move the reader to another tab
  const tab = chosenTab ?? firstTabOf(localStatus, commits);
  if (chosenTab === null && tab !== null) setChosenTab(tab);

  const uncommitted = useRepoDiff({
    ownerRepo,
    scope: "uncommitted",
    whitespace,
    enabled: tab === "uncommitted",
  });
  const branch = useRepoDiff({
    ownerRepo,
    scope: "committed",
    whitespace,
    enabled: tab === "branch",
  });
  const commitDiff = useCommitDiff({
    ownerRepo,
    sha: tab === "history" ? openSha : null,
    whitespace,
  });
  const status = fetchedStatus.data?.status ?? localStatus.data?.status ?? null;

  return (
    <CheckoutView
      title={ownerRepo}
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
      headerEnd={<RepoSyncButtons ownerRepo={ownerRepo} />}
      notices={<RepoSyncNotice ownerRepo={ownerRepo} />}
      onReload={() => {
        // a failed read is the query's error, shown in place
        invalidateRepo(client, ownerRepo).catch(() => undefined);
      }}
      onTabChange={setChosenTab}
      onWhitespaceToggle={() => {
        setWhitespace(whitespace === "show" ? "hide" : "show");
      }}
    />
  );
}

/** One listed checkout: what is uncommitted, its branch against the default branch, its history. */
export default function RepoPage(): ReactNode {
  const router = useRouter();
  const params = useLocalSearchParams<{ repo?: string }>();
  const ownerRepo = first(params.repo) ?? "";
  const valid = /^[^/\s]+\/[^/\s]+$/.test(ownerRepo);
  const { settings, loaded } = useDiffPreferences();

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
          ownerRepo={ownerRepo}
          initialWhitespace={settings.hideWhitespace ? "hide" : "show"}
          back={back}
        />
      </DiffSettingsProvider>
    </View>
  );
}
