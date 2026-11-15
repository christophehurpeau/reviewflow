import type {
  PullRequestSlots,
  PullRequestTab,
  RepositoryRefusalReason,
} from "@reviewflow/ui";
import {
  PullRequestDataSourceProvider,
  PullRequestScreen,
  isDiffFileOrder,
  isPullRequestTab,
} from "@reviewflow/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  ErrorMessage,
  IconButton,
  LinkText,
  ScreenScrollView,
  View,
} from "alouette";
import { ArrowLeftRegularIcon } from "alouette-icons/phosphor-icons/ArrowLeft";
import { DownloadSimpleRegularIcon } from "alouette-icons/phosphor-icons/DownloadSimple";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { mergedAccent } from "#/mergedAccent.ts";
import { CloneRepositoryModal } from "#/services/CloneRepositoryModal.tsx";
import { useDiffPreferences } from "#/services/DiffPreferencesProvider.tsx";
import { createLocalDraftStore } from "#/services/draftStore.ts";
import { createPullRequestDataSource } from "#/services/pullRequestDataSource.tsx";
import { rememberPullRequest } from "#/services/recentPullRequests.ts";
import { useRepos } from "#/services/reposApi.ts";
import { useStoredPreference } from "#/services/useStoredPreference.ts";

const first = (value: string[] | string | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

interface RepositoryActionsProps {
  ownerRepo: string;
  reason: RepositoryRefusalReason;
  onClone: () => void;
}

/**
 * Where a missing or wrong checkout is fixed: Settings, with the entry already
 * in the editor; or, when none is configured, a clone into a repositories
 * folder. A configured entry that fails its check is only fixed in Settings:
 * it wins over any clone.
 */
function RepositoryActions({
  ownerRepo,
  reason,
  onClone,
}: RepositoryActionsProps): ReactNode {
  const settings = (
    <Link asChild href={{ pathname: "/settings", params: { add: ownerRepo } }}>
      <Button
        text="Add it in Settings"
        accent="neutral"
        variant={reason === "notConfigured" ? "soft" : "tonal"}
        size="sm"
        role="link"
      />
    </Link>
  );
  if (reason !== "notConfigured") return settings;
  return (
    <View className="flex-row flex-wrap gap-xs">
      <Button
        text="Clone"
        icon={<DownloadSimpleRegularIcon />}
        accent="neutral"
        variant="tonal"
        size="sm"
        onPress={onClone}
      />
      {settings}
    </View>
  );
}

/** The route: parses and validates the url, owns tab and open commit, wires the data source. */
interface RepoLinkProps {
  /** as the repositories list names it */
  ownerRepo: string;
}

function RepoLink({ ownerRepo }: RepoLinkProps): ReactNode {
  return (
    <Link asChild href={{ pathname: "/repo", params: { repo: ownerRepo } }}>
      <LinkText text={ownerRepo} size="sm" accent="neutral" />
    </Link>
  );
}

export default function PullRequestPage(): ReactNode {
  const router = useRouter();
  const client = useQueryClient();
  const dataSource = useMemo(
    () => createPullRequestDataSource(client),
    [client],
  );
  // oxlint-disable-next-line react/hook-use-state -- created once, never replaced
  const [draftStore] = useState(createLocalDraftStore);
  const [diffFileOrder, setDiffFileOrder] = useStoredPreference(
    "reviewflow:diff-file-order",
    isDiffFileOrder,
    "packages",
  );
  const diffPreferences = useDiffPreferences();
  const repos = useRepos();
  const [cloneOpen, setCloneOpen] = useState(false);
  // a merged pull request is violet
  const slots = useMemo(
    (): PullRequestSlots => ({
      prStatusAccents: { merged: mergedAccent },
      renderRepositoryAction: (repo, reason) => (
        <RepositoryActions
          ownerRepo={repo}
          reason={reason}
          onClone={() => {
            setCloneOpen(true);
          }}
        />
      ),
    }),
    [],
  );
  const params = useLocalSearchParams<{
    repo?: string;
    number?: string;
    tab?: string;
    commit?: string;
  }>();
  const ownerRepo = first(params.repo) ?? "";
  const number = Number(first(params.number) ?? "");
  const tabParam = first(params.tab);
  const tab: PullRequestTab | undefined = isPullRequestTab(tabParam)
    ? tabParam
    : undefined;
  const commit = first(params.commit) ?? null;
  const valid =
    /^[^/\s]+\/[^/\s]+$/.test(ownerRepo) &&
    Number.isInteger(number) &&
    number >= 1;

  useEffect(() => {
    if (valid) rememberPullRequest({ ownerRepo, number });
  }, [valid, ownerRepo, number]);

  const goBack = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const back = (
    <IconButton
      icon={<ArrowLeftRegularIcon />}
      size="sm"
      aria-label="Back"
      onPress={goBack}
    />
  );

  // the url is the state: replace, so a tab switch is no history entry
  const setParams = (next: {
    tab?: PullRequestTab;
    commit?: string | null;
  }) => {
    router.setParams({
      tab: next.tab ?? tab,
      commit: next.commit === undefined ? (commit ?? "") : (next.commit ?? ""),
    });
  };

  // the whitespace preference is read once, when the screen mounts
  if (valid && !diffPreferences.loaded) return null;

  return (
    // the diff keeps its toolbar in view under the nearest vertical scroller
    <ScreenScrollView>
      {valid ? (
        <PullRequestDataSourceProvider value={dataSource}>
          {/* wide enough for a split diff beside its file list */}
          <View className="mx-auto w-full max-w-[1800px]">
            <PullRequestScreen
              ownerRepo={ownerRepo}
              number={number}
              tab={tab}
              headerStart={back}
              slots={slots}
              renderRepoLink={(name) => {
                // only a repository with a usable checkout has a screen
                const listed = repos.data?.repos.find(
                  (repo) =>
                    repo.problem === null &&
                    repo.ownerRepo.toLowerCase() === name.toLowerCase(),
                );
                return listed === undefined ? null : (
                  <RepoLink ownerRepo={listed.ownerRepo} />
                );
              }}
              draftStore={draftStore}
              diffFileOrder={diffFileOrder}
              diffTheme={diffPreferences.settings.theme}
              diffFont={diffPreferences.settings.font}
              diffCustomFont={diffPreferences.settings.customFont}
              diffWordWrap={diffPreferences.settings.wordWrap}
              initialWhitespace={
                diffPreferences.settings.hideWhitespace ? "hide" : "show"
              }
              openCommit={commit}
              onDiffFileOrderChange={setDiffFileOrder}
              onOpenCommitChange={(oid) => {
                setParams({ commit: oid });
              }}
              onTabChange={(next) => {
                setParams({ tab: next, commit: null });
              }}
            />
          </View>
          {/* outside the banner: a Message wraps its content in a Text, which every Text of the modal would inherit from */}
          <CloneRepositoryModal
            ownerRepo={ownerRepo}
            visible={cloneOpen}
            onClose={() => {
              setCloneOpen(false);
            }}
          />
        </PullRequestDataSourceProvider>
      ) : (
        <View className="mx-auto w-full max-w-[1200px] gap-m px-l pt-l">
          <View className="flex-row">{back}</View>
          <ErrorMessage>
            This address is not a pull request: it needs
            ?repo=owner/repo&number=n.
          </ErrorMessage>
        </View>
      )}
    </ScreenScrollView>
  );
}
