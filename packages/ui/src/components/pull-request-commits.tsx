import type {
  PullRequestCommit,
  PullRequestDetailResponse,
  PullRequestEdit,
} from "@reviewflow/sdk";
import { pluralOf } from "@reviewflow/sdk";
import { InfoMessage, Text, View } from "alouette";
import type { ReactNode } from "react";
import { useState } from "react";
import { usePullRequestDataSource } from "../dataSource.ts";
import { CommitHeader, CommitList } from "./commit-list.tsx";
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
      <CommitHeader commit={commit} onBack={onBack} />
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

  const unlisted = pullRequest.commitsTotal - listed.length;

  return (
    <View className="gap-m">
      <PullRequestPartReading reading={reading} />
      <PullRequestPartError error={error} />
      <CommitList commits={listed} onOpen={setOpenOid} />
      {unlisted > 0 ? (
        <Text className="text-xs text-muted">
          {`${pluralOf(unlisted, "more commit")} not listed`}
        </Text>
      ) : null}
    </View>
  );
}
