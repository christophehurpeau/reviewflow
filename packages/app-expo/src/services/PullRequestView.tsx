import type {
  PullRequestSlots,
  PullRequestTab,
  RepositoryRefusalReason,
} from "@reviewflow/ui";
import {
  PullRequestDataSourceProvider,
  PullRequestScreen,
  isDiffFileOrder,
} from "@reviewflow/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Button, LinkText, View } from "alouette";
import { DownloadSimpleRegularIcon } from "alouette-icons/phosphor-icons/DownloadSimple";
import { Link } from "expo-router";
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

interface PullRequestViewProps {
  ownerRepo: string;
  number: number;
  /** absent: the screen's first tab */
  tab: PullRequestTab | undefined;
  onTabChange: (tab: PullRequestTab) => void;
  openCommit: string | null;
  onOpenCommitChange: (oid: string | null) => void;
  /** at the start of the top line: a back button */
  headerStart: ReactNode;
}

/**
 * One pull request, wired to the app: its data source, its drafts, the diff
 * preferences and the clone of a missing checkout. Its parent scrolls it.
 */
export function PullRequestView({
  ownerRepo,
  number,
  tab,
  onTabChange,
  openCommit,
  onOpenCommitChange,
  headerStart,
}: PullRequestViewProps): ReactNode {
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

  useEffect(() => {
    rememberPullRequest({ ownerRepo, number });
  }, [ownerRepo, number]);

  // the whitespace preference is read once, when the screen mounts
  if (!diffPreferences.loaded) return null;

  return (
    <PullRequestDataSourceProvider value={dataSource}>
      {/* wide enough for a split diff beside its file list */}
      <View className="mx-auto w-full max-w-[1800px]">
        <PullRequestScreen
          ownerRepo={ownerRepo}
          number={number}
          tab={tab}
          headerStart={headerStart}
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
          openCommit={openCommit}
          onDiffFileOrderChange={setDiffFileOrder}
          onOpenCommitChange={onOpenCommitChange}
          onTabChange={onTabChange}
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
  );
}
