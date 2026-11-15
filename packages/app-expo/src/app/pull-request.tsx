import type { PullRequestTab } from "@reviewflow/ui";
import { isPullRequestTab } from "@reviewflow/ui";
import { ErrorMessage, IconButton, ScreenScrollView, View } from "alouette";
import { ArrowLeftRegularIcon } from "alouette-icons/phosphor-icons/ArrowLeft";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { PullRequestView } from "#/services/PullRequestView.tsx";

const first = (value: string[] | string | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/** The route: parses and validates the url, owns tab and open commit. */
export default function PullRequestPage(): ReactNode {
  const router = useRouter();
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

  return (
    // the diff keeps its toolbar in view under the nearest vertical scroller
    <ScreenScrollView>
      {valid ? (
        <PullRequestView
          ownerRepo={ownerRepo}
          number={number}
          tab={tab}
          headerStart={back}
          openCommit={commit}
          onOpenCommitChange={(oid) => {
            setParams({ commit: oid });
          }}
          onTabChange={(next) => {
            setParams({ tab: next, commit: null });
          }}
        />
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
