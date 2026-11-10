import type { PullRequestThread } from "@reviewflow/sdk";
import { suggestionOriginalLines } from "@reviewflow/sdk";
import {
  ActionButton,
  Badge,
  Box,
  Button,
  CodeBlock,
  ExternalLinkText,
  Text,
  View,
} from "alouette";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { errorToMessage } from "../services/errorToMessage.ts";
import { SuggestionOriginalContext } from "./markdown-suggestion.tsx";
import { CommentCard } from "./pull-request-conversation-card.tsx";
import type { ConversationEditing } from "./pull-request-conversation-edit.tsx";
import { Composer, useSendEdit } from "./pull-request-conversation-edit.tsx";
import { SuggestionActions } from "./pull-request-suggestion-actions.tsx";

/** The last lines of the hunk: the ones the comment was written under. */
const hunkTail = (diffHunk: string): string =>
  diffHunk
    .split("\n")
    .filter((line) => !line.startsWith("@@"))
    .slice(-4)
    .join("\n");

const lineRange = (thread: PullRequestThread): string => {
  const line = thread.line ?? thread.originalLine;
  if (line === null) return "";
  if (thread.startLine !== null && thread.startLine !== line) {
    return `:${String(thread.startLine)}-${String(line)}`;
  }
  return `:${String(line)}`;
};

interface ThreadProps {
  editing: ConversationEditing;
  thread: PullRequestThread;
}

/** Resolved threads start folded, as on GitHub: they are history, not a request. */
export function Thread({ editing, thread }: ThreadProps): ReactNode {
  const sendEdit = useSendEdit(editing);
  const [open, setOpen] = useState(!thread.resolved);
  const unlisted = thread.commentsTotal - thread.comments.length;
  const first = thread.comments[0];
  const last = thread.comments.at(-1);
  const original = useMemo(() => suggestionOriginalLines(thread), [thread]);

  const canToggle = thread.resolved
    ? thread.viewerCanUnresolve
    : thread.viewerCanResolve;
  const toggleResolved = canToggle ? (
    <ActionButton
      text={thread.resolved ? "Unresolve conversation" : "Resolve conversation"}
      accent="neutral"
      variant="tonal"
      size="sm"
      errorToMessage={errorToMessage}
      onPress={async () => {
        await sendEdit({
          kind: "resolveThread",
          threadId: thread.id,
          resolved: !thread.resolved,
        });
      }}
    />
  ) : null;

  return (
    <Box className="surface min-w-0 gap-sm p-m">
      <View className="flex-row flex-wrap items-center gap-xs">
        <Text
          className="min-w-0 shrink text-sm font-body-bold"
          numberOfLines={1}
        >
          {thread.path + lineRange(thread)}
        </Text>
        {thread.outdated ? (
          <Badge accent="warning" size="sm">
            outdated
          </Badge>
        ) : null}
        {thread.resolved ? (
          <Badge accent="success" size="sm">
            resolved
          </Badge>
        ) : null}
        {thread.resolvedBy === null ? null : (
          <Text className="text-sm text-muted">
            {`by ${thread.resolvedBy.login}`}
          </Text>
        )}
        {thread.resolved ? (
          <Button
            text={open ? "Hide" : "Show"}
            accent="neutral"
            variant="soft"
            size="sm"
            onPress={() => {
              setOpen(!open);
            }}
          />
        ) : null}
      </View>
      {open ? (
        <View className="gap-m">
          <CodeBlock size="sm">{hunkTail(thread.diffHunk)}</CodeBlock>
          <SuggestionOriginalContext value={original}>
            {thread.comments.map((comment) => (
              <CommentCard
                key={comment.id}
                bare
                editing={editing}
                author={comment.author}
                action="commented"
                createdAt={comment.createdAt}
                lastEditedAt={comment.lastEditedAt}
                url={comment.url}
                body={comment.body}
                canEdit={comment.viewerCanUpdate}
                reactable={comment}
                toEdit={(body) => ({
                  kind: "editComment",
                  target: "reviewComment",
                  databaseId: comment.databaseId,
                  body,
                })}
                footer={<SuggestionActions thread={thread} comment={comment} />}
              />
            ))}
          </SuggestionOriginalContext>
          {unlisted > 0 && last !== undefined ? (
            <ExternalLinkText
              size="sm"
              href={last.url}
              text={`${String(unlisted)} more on GitHub`}
            />
          ) : null}
          {thread.viewerCanReply && first !== undefined ? (
            <Composer
              editing={editing}
              draftKey={`reply:${thread.id}`}
              ariaLabel="Reply"
              buttonText="Reply"
              toEdit={(body) => ({
                kind: "reply",
                inReplyTo: first.databaseId,
                body,
              })}
              extraActions={() => toggleResolved}
            />
          ) : (
            toggleResolved
          )}
        </View>
      ) : null}
    </Box>
  );
}
