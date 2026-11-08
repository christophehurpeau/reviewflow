import type { PullRequestSlots, PullRequestTab } from "@reviewflow/ui";
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
  ScreenScrollView,
  View,
} from "alouette";
import { ArrowLeftRegularIcon } from "alouette-icons/phosphor-icons/ArrowLeft";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useDiffPreferences } from "#/services/DiffPreferencesProvider.tsx";
import { createLocalDraftStore } from "#/services/draftStore.ts";
import { createPullRequestDataSource } from "#/services/pullRequestDataSource.tsx";
import { rememberPullRequest } from "#/services/recentPullRequests.ts";
import { useStoredPreference } from "#/services/useStoredPreference.ts";

const first = (value: string[] | string | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/** Where a missing or wrong checkout is fixed: Settings, with the entry already in the editor. */
const slots: PullRequestSlots = {
  renderRepositoryAction: (ownerRepo) => (
    <Link asChild href={{ pathname: "/settings", params: { add: ownerRepo } }}>
      <Button
        text="Add it in Settings"
        accent="neutral"
        variant="tonal"
        size="sm"
        role="link"
      />
    </Link>
  ),
};

/** The route: parses and validates the url, owns tab and open commit, wires the data source. */
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
  const params = useLocalSearchParams<{
    repo?: string;
    number?: string;
    tab?: string;
    commit?: string;
  }>();
  const ownerRepo = first(params.repo) ?? "";
  const number = Number(first(params.number) ?? "");
  const tabParam = first(params.tab);
  const tab: PullRequestTab = isPullRequestTab(tabParam)
    ? tabParam
    : "timeline";
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
              draftStore={draftStore}
              diffFileOrder={diffFileOrder}
              diffTheme={diffPreferences.settings.theme}
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
