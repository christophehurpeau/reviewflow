import type {
  PullRequestCommit,
  PullRequestDetailResponse,
  PullRequestEdit,
} from "@reviewflow/sdk";
import { pluralOf } from "@reviewflow/sdk";
import {
  Button,
  Code,
  InfoMessage,
  PressableListItem,
  Text,
  View,
} from "alouette";
import { ArrowLeftRegularIcon } from "alouette-icons/phosphor-icons/ArrowLeft";
import type { ReactNode } from "react";
import { useState } from "react";
import { usePullRequestDataSource } from "../dataSource.ts";
import { formatDataAge } from "../services/formatDataAge.ts";
import { PersonAvatar } from "./pull-request-conversation-person.tsx";
import { PullRequestDiffView } from "./pull-request-diff-view.tsx";
import {
  PullRequestPartError,
  PullRequestPartPending,
  PullRequestPartReading,
} from "./pull-request-part-notice.tsx";

export interface PullRequestCommitsProps {
  detail: PullRequestDetailResponse;
  /** reads the pull request again once GitHub took a comment */
  onEdited: (edit: PullRequestEdit) => Promise<void>;
  /**
   * The commit whose diff is open, by oid; absent: the component holds it
   * itself. Pass it, with `onOpenCommitChange`, to keep it in a url.
   */
  openCommit?: string | null;
  onOpenCommitChange?: (oid: string | null) => void;
}

const shortSha = (oid: string): string => oid.slice(0, 7);

const dayOf = (commit: PullRequestCommit): string =>
  new Date(commit.committedAt).toLocaleDateString([], {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

interface CommitRowProps {
  commit: PullRequestCommit;
  onOpen: () => void;
}

/** A link, as a board row is: it opens the commit's own page, which a url keeps. */
function CommitRow({ commit, onOpen }: CommitRowProps): ReactNode {
  const login = commit.author?.login ?? "unknown";

  return (
    <PressableListItem
      role="link"
      aria-label={`Show the changes of ${commit.headline}`}
      onPress={onOpen}
    >
      <View className="flex-row items-center gap-sm">
        <PersonAvatar person={commit.author} />
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-body-bold" numberOfLines={1}>
            {commit.headline}
          </Text>
          <Text className="text-xs text-muted" numberOfLines={1}>
            {`${login} committed ${formatDataAge(commit.committedAt)}`}
          </Text>
        </View>
        <Code className="text-xs">{shortSha(commit.oid)}</Code>
      </View>
    </PressableListItem>
  );
}

interface CommitDiffProps {
  detail: PullRequestDetailResponse;
  commit: PullRequestCommit;
  onBack: () => void;
  onEdited: (edit: PullRequestEdit) => Promise<void>;
}

/**
 * A commit's own diff. A comment is anchored on the commit, as GitHub's
 * commit view does, on the new side only: GitHub reads the old side's line
 * numbers against the pull request's base, not this commit's parent.
 */
function CommitDiff({
  detail,
  commit,
  onBack,
  onEdited,
}: CommitDiffProps): ReactNode {
  const { pullRequest } = detail;
  const dataSource = usePullRequestDataSource();
  return (
    <View className="gap-m">
      <View className="flex-row flex-wrap items-center gap-sm">
        <Button
          text="Back to commits"
          icon={<ArrowLeftRegularIcon />}
          accent="neutral"
          variant="tonal"
          size="sm"
          onPress={onBack}
        />
        <Text className="min-w-0 flex-1 text-sm font-body-bold">
          {commit.headline}
        </Text>
        <Code className="text-xs">{shortSha(commit.oid)}</Code>
      </View>
      {commit.body.trim() === "" ? null : (
        <Text className="select-auto font-mono text-xs text-muted">
          {commit.body}
        </Text>
      )}
      {commit.parentOid === null ? (
        <InfoMessage>
          This is a root commit with no parent: its changes cannot be shown.
        </InfoMessage>
      ) : (
        <PullRequestDiffView
          range={{
            ownerRepo: pullRequest.ownerRepo,
            number: pullRequest.number,
            head: commit.oid,
            base: commit.parentOid,
          }}
          review={{
            commentable: true,
            rightOnly: true,
            commitOid: commit.oid,
            headSha: pullRequest.headSha,
            threads: [],
            files: [],
            onEdit: async (edit) => {
              await dataSource.edit(pullRequest, edit);
              await onEdited(edit);
            },
            onViewed: () => Promise.resolve(),
          }}
        />
      )}
    </View>
  );
}

/** Oldest first, grouped by day as on GitHub; pressing a commit shows its own diff, read-only. */
export function PullRequestCommits({
  detail,
  onEdited,
  openCommit,
  onOpenCommitChange,
}: PullRequestCommitsProps): ReactNode {
  const { pullRequest } = detail;
  const { usePart } = usePullRequestDataSource();
  const [localOid, setLocalOid] = useState<string | null>(null);
  const openOid = openCommit === undefined ? localOid : openCommit;
  const { value, error, reading } = usePart(pullRequest, "commits");
  if (value === null) {
    return <PullRequestPartPending error={error} what="the commits" />;
  }
  const { commits: listed } = value;
  const opened = listed.find(({ oid }) => oid === openOid);
  const setOpenOid = (oid: string | null): void => {
    setLocalOid(oid);
    onOpenCommitChange?.(oid);
  };

  if (opened !== undefined) {
    return (
      <CommitDiff
        key={opened.oid}
        detail={detail}
        commit={opened}
        onEdited={onEdited}
        onBack={() => {
          setOpenOid(null);
        }}
      />
    );
  }

  const days = new Map<string, PullRequestCommit[]>();
  for (const commit of listed) {
    const day = dayOf(commit);
    const ofDay = days.get(day);
    if (ofDay === undefined) days.set(day, [commit]);
    else ofDay.push(commit);
  }
  const unlisted = pullRequest.commitsTotal - listed.length;

  return (
    <View className="gap-m">
      <PullRequestPartReading reading={reading} />
      <PullRequestPartError error={error} />
      {[...days].map(([day, commits]) => (
        <View key={day} className="gap-xs">
          <Text className="text-xs font-body-bold text-muted">{day}</Text>
          {commits.map((commit) => (
            <CommitRow
              key={commit.oid}
              commit={commit}
              onOpen={() => {
                setOpenOid(commit.oid);
              }}
            />
          ))}
        </View>
      ))}
      {unlisted > 0 ? (
        <Text className="text-xs text-muted">
          {`${pluralOf(unlisted, "more commit")} not listed`}
        </Text>
      ) : null}
    </View>
  );
}
