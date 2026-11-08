import type {
  PullRequestComment,
  PullRequestDraftComment,
  PullRequestEdit,
  PullRequestThread,
} from "@reviewflow/sdk";
import { pluralOf, suggestionOriginalLines } from "@reviewflow/sdk";
import {
  ActionButton,
  Badge,
  Button,
  ExternalLinkText,
  Text,
  Tooltip,
  View,
} from "alouette";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  useDraftText,
  useHasDraftText,
} from "../services/PullRequestDraftsProvider.tsx";
import type { PendingComment } from "../services/PullRequestReviewDraftProvider.tsx";
import { errorToMessage } from "../services/errorToMessage.ts";
import { formatDataAge } from "../services/formatDataAge.ts";
import { SuggestionOriginalContext } from "./markdown-suggestion.tsx";
import { MarkdownText } from "./markdown-text.tsx";
import { PersonAvatar } from "./pull-request-conversation-person.tsx";
import type { LineAnchor } from "./pull-request-diff-lines.ts";
import { suggestionBlock } from "./pull-request-diff-lines.ts";
import { PullRequestMarkdownInput } from "./pull-request-markdown-input.tsx";
import { PullRequestReactions } from "./pull-request-reactions.tsx";
import { SuggestionActions } from "./pull-request-suggestion-actions.tsx";

export type AnnotationItem =
  | { kind: "composer"; anchor: LineAnchor; suggestionLines: string[] | null }
  | { kind: "pending"; comment: PendingComment }
  | { kind: "thread"; thread: PullRequestThread };

/** One diff line holds one slot, so everything anchored there shares an annotation. */
export interface AnnotationGroup {
  items: AnnotationItem[];
}

export type EditPullRequest = (edit: PullRequestEdit) => Promise<void>;

export interface ReviewDraftActions {
  hasPending: boolean;
  add: (comment: PullRequestDraftComment) => void;
  update: (key: string, body: string) => void;
  remove: (key: string) => void;
}

/** Flat: it sits inside the file's card, which is already raised. */
function Frame({ children }: { children: ReactNode }): ReactNode {
  return (
    <View className="p-xs">
      <View className="min-w-0 gap-sm rounded-sm border border-border-muted p-m">
        {children}
      </View>
    </View>
  );
}

interface CommentViewProps {
  thread: PullRequestThread;
  comment: PullRequestComment;
  onEdit: EditPullRequest;
}

function CommentView({ thread, comment, onEdit }: CommentViewProps): ReactNode {
  return (
    <View className="gap-xs">
      <View className="flex-row flex-wrap items-center gap-xs">
        <PersonAvatar person={comment.author} />
        <Text className="text-sm font-body-bold">{comment.author.login}</Text>
        <ExternalLinkText
          size="sm"
          href={comment.url}
          text={formatDataAge(comment.createdAt)}
        />
      </View>
      {comment.body.trim() === "" ? null : (
        <MarkdownText github text={comment.body} />
      )}
      <SuggestionActions thread={thread} comment={comment} />
      <PullRequestReactions subject={comment} onEdit={onEdit} />
    </View>
  );
}

interface ThreadAnnotationProps {
  thread: PullRequestThread;
  onEdit: EditPullRequest;
}

/** Resolved threads start folded, as on GitHub. */
export function ThreadAnnotation({
  thread,
  onEdit,
}: ThreadAnnotationProps): ReactNode {
  const [open, setOpen] = useState(!thread.resolved);
  // shared with the conversation tab's reply box of the same thread
  const reply = useDraftText(`reply:${thread.id}`);
  const first = thread.comments[0];
  const unlisted = thread.commentsTotal - thread.comments.length;
  const original = useMemo(() => suggestionOriginalLines(thread), [thread]);

  if (!open) {
    return (
      <Frame>
        <View className="flex-row flex-wrap items-center gap-xs">
          <Badge accent="success" size="sm">
            Resolved
          </Badge>
          <Text className="text-sm text-muted">
            {`${first?.author.login ?? "thread"}, ${pluralOf(thread.commentsTotal, "comment")}`}
          </Text>
          <Button
            size="sm"
            accent="neutral"
            variant="soft"
            text="Show"
            onPress={() => {
              setOpen(true);
            }}
          />
        </View>
      </Frame>
    );
  }

  return (
    <Frame>
      {thread.resolved ? (
        <View className="flex-row items-center gap-xs">
          <Badge accent="success" size="sm">
            Resolved
          </Badge>
          <Button
            size="sm"
            accent="neutral"
            variant="soft"
            text="Hide"
            onPress={() => {
              setOpen(false);
            }}
          />
        </View>
      ) : null}
      <SuggestionOriginalContext value={original}>
        {thread.comments.map((comment) => (
          <CommentView
            key={comment.id}
            thread={thread}
            comment={comment}
            onEdit={onEdit}
          />
        ))}
      </SuggestionOriginalContext>
      {unlisted > 0 ? (
        <Text className="text-xs text-muted">
          {`${pluralOf(unlisted, "more comment")} on GitHub`}
        </Text>
      ) : null}
      {thread.viewerCanReply && first !== undefined ? (
        <View className="gap-xs">
          <PullRequestMarkdownInput
            aria-label="Reply"
            value={reply.text}
            onChange={reply.setText}
          />
          <View className="flex-row flex-wrap items-center justify-end gap-xs">
            {thread.resolved && thread.viewerCanUnresolve ? (
              <Tooltip
                content="Open the thread again, here and on GitHub"
                render={(triggerProps) => (
                  <ActionButton
                    {...triggerProps}
                    size="sm"
                    accent="neutral"
                    variant="soft"
                    text="Unresolve"
                    errorMessageVariant="flat"
                    errorToMessage={errorToMessage}
                    onPress={async () => {
                      await onEdit({
                        kind: "resolveThread",
                        threadId: thread.id,
                        resolved: false,
                      });
                    }}
                  />
                )}
              />
            ) : null}
            {!thread.resolved && thread.viewerCanResolve ? (
              <Tooltip
                content="Mark the thread done: it folds, here and on GitHub"
                render={(triggerProps) => (
                  <ActionButton
                    {...triggerProps}
                    size="sm"
                    accent="neutral"
                    variant="soft"
                    text="Resolve"
                    errorMessageVariant="flat"
                    errorToMessage={errorToMessage}
                    onPress={async () => {
                      await onEdit({
                        kind: "resolveThread",
                        threadId: thread.id,
                        resolved: true,
                      });
                    }}
                  />
                )}
              />
            ) : null}
            <ActionButton
              size="sm"
              text="Reply"
              errorMessageVariant="flat"
              errorToMessage={errorToMessage}
              onPress={async () => {
                const sent = reply.text;
                if (sent.trim() === "") return;
                await onEdit({
                  kind: "reply",
                  inReplyTo: first.databaseId,
                  body: sent,
                });
                reply.discard(sent);
              }}
            />
          </View>
        </View>
      ) : null}
    </Frame>
  );
}

interface PendingAnnotationProps {
  comment: PendingComment;
  draft: ReviewDraftActions;
}

export function PendingAnnotation({
  comment,
  draft,
}: PendingAnnotationProps): ReactNode {
  const draftKey = `pending:${comment.key}`;
  const hasDraft = useHasDraftText(draftKey);
  const [editing, setEditing] = useState(hasDraft);
  const body = useDraftText(draftKey, comment.body);

  return (
    <Frame>
      <View className="flex-row flex-wrap items-center gap-xs">
        <Badge accent="warning" size="sm">
          Pending
        </Badge>
        <Text className="text-sm text-muted">sent with your review</Text>
      </View>
      {editing ? (
        <View className="gap-xs">
          <PullRequestMarkdownInput
            aria-label="Pending comment"
            value={body.text}
            onChange={body.setText}
          />
          <View className="flex-row justify-end gap-xs">
            <Button
              size="sm"
              accent="neutral"
              variant="soft"
              text="Cancel"
              onPress={() => {
                body.discard();
                setEditing(false);
              }}
            />
            <Button
              size="sm"
              text="Save"
              onPress={() => {
                if (body.text.trim() === "") return;
                draft.update(comment.key, body.text);
                body.discard();
                setEditing(false);
              }}
            />
          </View>
        </View>
      ) : (
        <>
          <MarkdownText github text={comment.body} />
          <View className="flex-row gap-xs">
            <Button
              size="sm"
              accent="neutral"
              text="Edit"
              onPress={() => {
                setEditing(true);
              }}
            />
            <Button
              size="sm"
              accent="danger"
              variant="soft"
              text="Delete"
              onPress={() => {
                draft.remove(comment.key);
              }}
            />
          </View>
        </>
      )}
    </Frame>
  );
}

interface ComposerAnnotationProps {
  anchor: LineAnchor;
  suggestionLines: string[] | null;
  commitId: string;
  /**
   * null on a single commit's diff: a review is sent on the pull request's
   * head, so a comment anchored on another commit goes out alone.
   */
  draft: ReviewDraftActions | null;
  onEdit: EditPullRequest;
  onClose: () => void;
}

export function ComposerAnnotation({
  anchor,
  suggestionLines,
  commitId,
  draft,
  onEdit,
  onClose,
}: ComposerAnnotationProps): ReactNode {
  const body = useDraftText(
    `inline:${commitId}:${anchor.path}:${anchor.side}:${String(anchor.startLine ?? "")}-${String(anchor.line)}`,
  );
  const close = (): void => {
    body.discard();
    onClose();
  };
  const range =
    anchor.startLine === null
      ? `line ${String(anchor.line)}`
      : `lines ${String(anchor.startLine)} to ${String(anchor.line)}`;
  const comment = {
    path: anchor.path,
    side: anchor.side,
    line: anchor.line,
    startLine: anchor.startLine,
    startSide: anchor.startSide,
    body: body.text,
  };

  return (
    <Frame>
      <Text className="text-sm text-muted">{`Comment on ${range}`}</Text>
      <PullRequestMarkdownInput
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- the composer is opened by pressing a line, the reader expects to type
        autoFocus
        aria-label="Comment"
        value={body.text}
        onChange={body.setText}
      />
      <View className="flex-row flex-wrap items-center gap-xs">
        {suggestionLines === null ? null : (
          <Tooltip
            content="Insert the selected lines as a suggested change, which can then be committed to the branch, from here or GitHub"
            render={(triggerProps) => (
              <Button
                {...triggerProps}
                size="sm"
                accent="neutral"
                text="Suggestion"
                onPress={() => {
                  body.setText(
                    `${body.text}${body.text === "" ? "" : "\n"}${suggestionBlock(suggestionLines)}`,
                  );
                }}
              />
            )}
          />
        )}
        <View className="ml-auto flex-row flex-wrap items-center justify-end gap-xs">
          <Button
            size="sm"
            accent="neutral"
            variant="soft"
            text="Cancel"
            onPress={close}
          />
          {draft === null ? null : (
            <Tooltip
              content="Keep the comment pending: it is sent with your review, from Review changes"
              render={(triggerProps) => (
                <Button
                  {...triggerProps}
                  size="sm"
                  accent="neutral"
                  text={
                    draft.hasPending ? "Add review comment" : "Start a review"
                  }
                  onPress={() => {
                    if (body.text.trim() === "") return;
                    draft.add(comment);
                    close();
                  }}
                />
              )}
            />
          )}
          <Tooltip
            content="Post this comment now, on its own, outside any review"
            render={(triggerProps) => (
              <ActionButton
                {...triggerProps}
                size="sm"
                text="Add single comment"
                errorMessageVariant="flat"
                errorToMessage={errorToMessage}
                onPress={async () => {
                  if (comment.body.trim() === "") return;
                  await onEdit({ kind: "inlineComment", commitId, comment });
                  body.discard(comment.body);
                  onClose();
                }}
              />
            )}
          />
        </View>
      </View>
    </Frame>
  );
}
