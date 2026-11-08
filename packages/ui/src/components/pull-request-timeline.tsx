import type {
  PullRequestDetailResponse,
  PullRequestEdit,
  PullRequestEvent,
  PullRequestTimelineItem,
} from "@reviewflow/sdk";
import { ActionButton, ExternalLinkText, View } from "alouette";
import type { ReactNode } from "react";
import { usePullRequestDataSource } from "../dataSource.ts";
import { errorToMessage } from "../services/errorToMessage.ts";
import { CommentCard } from "./pull-request-conversation-card.tsx";
import {
  Composer,
  type ComposerDraft,
  type ConversationEditing,
  useSendEdit,
} from "./pull-request-conversation-edit.tsx";
import { CommitsLine, EventLine } from "./pull-request-conversation-event.tsx";
import { Thread } from "./pull-request-conversation-thread.tsx";
import {
  PullRequestPartError,
  PullRequestPartPending,
  PullRequestPartReading,
} from "./pull-request-part-notice.tsx";

type TimelineEntry =
  | { kind: "commits"; events: PullRequestEvent[] }
  | { kind: "item"; item: PullRequestTimelineItem };

const isCommit = (item: PullRequestTimelineItem): item is PullRequestEvent =>
  item.kind === "event" && item.action === "committed";

/** Consecutive commits of one actor, with nothing between them, are one push. */
const groupCommits = (timeline: PullRequestTimelineItem[]): TimelineEntry[] => {
  const entries: TimelineEntry[] = [];
  for (const item of timeline) {
    const previous = entries.at(-1);
    if (
      isCommit(item) &&
      previous?.kind === "commits" &&
      previous.events[0]?.actor?.login === item.actor?.login
    ) {
      previous.events.push(item);
    } else if (isCommit(item)) {
      entries.push({ kind: "commits", events: [item] });
    } else {
      entries.push({ kind: "item", item });
    }
  }
  return entries;
};

const entryKey = (entry: TimelineEntry, index: number): string => {
  if (entry.kind === "commits") {
    return `commits:${entry.events[0]?.createdAt ?? ""}:${String(index)}`;
  }
  const { item } = entry;
  if (item.kind === "event") {
    return `event:${item.action}:${item.createdAt}:${String(index)}`;
  }
  return `${item.kind}:${item.id}`;
};

interface TimelineEntryViewProps {
  editing: ConversationEditing;
  entry: TimelineEntry;
}

function TimelineEntryView({
  editing,
  entry,
}: TimelineEntryViewProps): ReactNode {
  if (entry.kind === "commits") return <CommitsLine events={entry.events} />;
  const { item } = entry;
  if (item.kind === "event") return <EventLine event={item} />;
  if (item.kind === "thread") return <Thread editing={editing} thread={item} />;
  if (item.kind === "review") {
    return (
      <CommentCard
        editing={editing}
        author={item.author}
        action="reviewed"
        verdict={item.state}
        createdAt={item.createdAt}
        lastEditedAt={item.lastEditedAt}
        url={item.url}
        body={item.body}
        canEdit={item.viewerCanUpdate}
        reactable={item}
        toEdit={(body) => ({
          kind: "editComment",
          target: "review",
          databaseId: item.databaseId,
          body,
        })}
      />
    );
  }
  return (
    <CommentCard
      editing={editing}
      author={item.author}
      action="commented"
      createdAt={item.createdAt}
      lastEditedAt={item.lastEditedAt}
      url={item.url}
      body={item.body}
      canEdit={item.viewerCanUpdate}
      reactable={item}
      toEdit={(body) => ({
        kind: "editComment",
        target: "issueComment",
        databaseId: item.databaseId,
        body,
      })}
    />
  );
}

interface CloseWithCommentProps {
  editing: ConversationEditing;
  draft: ComposerDraft;
}

/**
 * Closing requires a comment saying why, posted first so it reads above the
 * close event. A refused close leaves the comment posted and the box cleared.
 */
function CloseWithComment({
  editing,
  draft,
}: CloseWithCommentProps): ReactNode {
  const { pullRequest } = editing;
  const sendEdit = useSendEdit(editing);
  if (!pullRequest.viewerCanUpdate || pullRequest.state !== "open") return null;

  return (
    <ActionButton
      text="Close with comment"
      accent="danger"
      variant="tonal"
      size="sm"
      disabledReason={
        draft.body.trim() === ""
          ? "Write a comment saying why it is closed."
          : null
      }
      errorToMessage={errorToMessage}
      onPress={async () => {
        await sendEdit({ kind: "comment", body: draft.body });
        draft.clear();
        await sendEdit({ kind: "state", state: "closed" });
      }}
    />
  );
}

export interface PullRequestTimelineProps {
  detail: PullRequestDetailResponse;
  /** reads the pull request again once GitHub took a change */
  onEdited: (edit: PullRequestEdit) => Promise<void>;
}

/** The description, as GitHub's first comment. */
export function PullRequestDescription({
  detail,
  onEdited,
}: PullRequestTimelineProps): ReactNode {
  const { pullRequest } = detail;
  return (
    <CommentCard
      editing={{ pullRequest, onEdited }}
      author={pullRequest.author}
      action="opened"
      createdAt={pullRequest.createdAt}
      lastEditedAt={pullRequest.lastEditedAt}
      url={pullRequest.url}
      body={pullRequest.body}
      emptyText="No description provided."
      canEdit={pullRequest.viewerCanUpdate}
      reactable={pullRequest}
      toEdit={(body) => ({ kind: "body", body })}
    />
  );
}

const isConversation = (item: PullRequestTimelineItem): boolean =>
  item.kind !== "event";

/** Comments, reviews and threads only: what a reviewer reads, without the events. */
export const conversationCount = (
  timeline: PullRequestTimelineItem[],
): number => timeline.filter(isConversation).length;

export interface PullRequestTimelineEntriesProps extends PullRequestTimelineProps {
  /** leaves out commits, label changes and the other events */
  conversationOnly?: boolean;
}

/** The timeline part, oldest first, once read. */
export function PullRequestTimelineEntries({
  detail,
  onEdited,
  conversationOnly = false,
}: PullRequestTimelineEntriesProps): ReactNode {
  const { pullRequest } = detail;
  const { value, error, reading } = usePullRequestDataSource().usePart(
    pullRequest,
    "timeline",
  );
  const editing: ConversationEditing = { pullRequest, onEdited };
  if (value === null) {
    return <PullRequestPartPending error={error} what="the timeline" />;
  }
  const items = conversationOnly
    ? value.timeline.filter(isConversation)
    : value.timeline;
  return (
    <>
      <PullRequestPartReading reading={reading} />
      <PullRequestPartError error={error} />
      {value.timelineTruncated ? (
        <ExternalLinkText
          size="sm"
          href={pullRequest.url}
          text="Older activity is only on GitHub"
        />
      ) : null}
      {groupCommits(items).map((entry, index) => (
        <TimelineEntryView
          key={entryKey(entry, index)}
          editing={editing}
          entry={entry}
        />
      ))}
    </>
  );
}

/**
 * The conversation as GitHub's page has it: the description, then comments,
 * reviews, threads on the code and events oldest first, then a box to comment.
 */
export function PullRequestTimeline({
  detail,
  onEdited,
}: PullRequestTimelineProps): ReactNode {
  const { pullRequest } = detail;
  const editing: ConversationEditing = { pullRequest, onEdited };

  return (
    <View className="gap-m">
      <PullRequestDescription detail={detail} onEdited={onEdited} />
      <PullRequestTimelineEntries detail={detail} onEdited={onEdited} />
      <Composer
        editing={editing}
        draftKey="comment"
        title="Add a comment"
        ariaLabel="New comment"
        buttonText="Comment"
        toEdit={(body) => ({ kind: "comment", body })}
        // a render prop called by the composer, not a component defined here
        // oxlint-disable-next-line react/no-unstable-nested-components
        extraActions={(draft) => (
          <CloseWithComment editing={editing} draft={draft} />
        )}
      />
    </View>
  );
}
