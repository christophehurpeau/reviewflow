import type { DiffWhitespace } from "@reviewflow/sdk";
import type { BranchDiffTab } from "@reviewflow/ui";
import {
  BranchDiffView,
  CheckoutSyncButtons,
  DiffSettingsProvider,
} from "@reviewflow/ui";
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

interface RepoSyncProps {
  ownerRepo: string;
}

/** Pull and Push, shown once the status (fetched first) says they apply. */
function RepoSyncButtons({ ownerRepo }: RepoSyncProps): ReactNode {
  const client = useQueryClient();
  const { data } = useRepoStatus(ownerRepo);
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
  const { data, error } = useRepoStatus(ownerRepo);
  const problem = error?.message ?? data?.fetchError ?? null;
  if (problem === null) return null;
  return <WarningMessage>{`Could not fetch: ${problem}`}</WarningMessage>;
}

interface RepoDiffProps {
  ownerRepo: string;
  initialWhitespace: DiffWhitespace;
  back: ReactNode;
}

function RepoDiff({
  ownerRepo,
  initialWhitespace,
  back,
}: RepoDiffProps): ReactNode {
  const client = useQueryClient();
  const [tab, setTab] = useState<BranchDiffTab>("all");
  const [openSha, setOpenSha] = useState<string | null>(null);
  const [whitespace, setWhitespace] = useState(initialWhitespace);
  const onCommits = tab === "commits";
  const diff = useRepoDiff({
    ownerRepo,
    scope: tab === "committed" ? "committed" : "all",
    whitespace,
    enabled: !onCommits,
  });
  const commits = useRepoCommits(ownerRepo, onCommits);
  const commitDiff = useCommitDiff({
    ownerRepo,
    sha: onCommits ? openSha : null,
    whitespace,
  });

  return (
    <BranchDiffView
      title={ownerRepo}
      diff={diff.data ?? null}
      error={diff.error?.message ?? null}
      loading={diff.isFetching}
      tab={tab}
      commits={{
        list: commits.data?.commits ?? null,
        error: commits.error?.message ?? null,
        loading: commits.isFetching,
        openSha,
        diff: commitDiff.data ?? null,
        diffError: commitDiff.error?.message ?? null,
        diffLoading: commitDiff.isFetching,
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
      onTabChange={setTab}
      onWhitespaceToggle={() => {
        setWhitespace(whitespace === "show" ? "hide" : "show");
      }}
    />
  );
}

/** One configured checkout: its checked-out branch against the repository's default branch. */
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
        <RepoDiff
          ownerRepo={ownerRepo}
          initialWhitespace={settings.hideWhitespace ? "hide" : "show"}
          back={back}
        />
      </DiffSettingsProvider>
    </View>
  );
}
