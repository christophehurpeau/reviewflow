import type {
  PullRequestEdit,
  PullRequestPerson,
  PullRequestReactable,
  PullRequestReviewState,
} from "@reviewflow/sdk";
import type { Accent } from "alouette";
import {
  Badge,
  Box,
  ExternalLinkText,
  IconButton,
  Text,
  Tooltip,
  View,
} from "alouette";
import { PencilSimpleRegularIcon } from "alouette-icons/phosphor-icons/PencilSimple";
import type { ReactNode } from "react";
import { useState } from "react";
import { useHasDraftText } from "../services/PullRequestDraftsProvider.tsx";
import { formatDataAge } from "../services/formatDataAge.ts";
import { linkInRow } from "./link-in-row.ts";
import { MarkdownText } from "./markdown-text.tsx";
import type { ConversationEditing } from "./pull-request-conversation-edit.tsx";
import { BodyEditor, useSendEdit } from "./pull-request-conversation-edit.tsx";
import { PersonAvatar } from "./pull-request-conversation-person.tsx";
import { PullRequestReactions } from "./pull-request-reactions.tsx";
import { EditedLink } from "./pull-request-revisions.tsx";

const verdictLabel = (state: PullRequestReviewState): string => {
  if (state === "approved") return "approved these changes";
  if (state === "changesRequested") return "requested changes";
  if (state === "dismissed") return "review dismissed";
  if (state === "pending") return "pending review";
  return "reviewed";
};

const verdictAccent = (state: PullRequestReviewState): Accent => {
  if (state === "approved") return "success";
  if (state === "changesRequested") return "danger";
  if (state === "pending") return "warning";
  return "info";
};

interface CardHeaderProps {
  author: PullRequestPerson | null;
  /** a review's verdict, shown as a badge instead of `action` */
  verdict?: PullRequestReviewState;
  action: string;
  createdAt: string;
  url: string;
  edited: ReactNode;
  onEdit: (() => void) | null;
}

function CardHeader({
  author,
  verdict,
  action,
  createdAt,
  url,
  edited,
  onEdit,
}: CardHeaderProps): ReactNode {
  return (
    <View className="flex-row items-center gap-xs">
      <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-xs">
        <PersonAvatar person={author} />
        <Text className="text-sm font-body-bold">
          {author?.login ?? "ghost"}
        </Text>
        {verdict === undefined ? (
          <Text className="text-sm text-muted">{action}</Text>
        ) : (
          <Badge accent={verdictAccent(verdict)} size="sm">
            {verdictLabel(verdict)}
          </Badge>
        )}
        <ExternalLinkText
          size="sm"
          href={url}
          text={formatDataAge(createdAt)}
          className={linkInRow}
        />
        {edited}
      </View>
      {onEdit === null ? null : (
        <Tooltip
          content="Edit the text, on GitHub too"
          render={(triggerProps) => (
            <IconButton
              {...triggerProps}
              icon={<PencilSimpleRegularIcon />}
              aria-label="Edit"
              accent="neutral"
              variant="soft"
              size="sm"
              onPress={onEdit}
            />
          )}
        />
      )}
    </View>
  );
}

interface CommentCardProps {
  editing: ConversationEditing;
  author: PullRequestPerson | null;
  action: string;
  verdict?: PullRequestReviewState;
  createdAt: string;
  lastEditedAt: string | null;
  url: string;
  body: string;
  /** what an empty body says; without it an empty body renders nothing */
  emptyText?: string;
  canEdit: boolean;
  toEdit: (body: string) => PullRequestEdit;
  /** what the reactions under the body are those of */
  reactable: PullRequestReactable;
  /** inside a thread's frame, which is already the card */
  bare?: boolean;
  /** under the body, hidden with it while editing */
  footer?: ReactNode;
}

/**
 * One piece of the conversation with its author: the body is rendered
 * markdown, edited in place through `toEdit`, and its task checkboxes save the
 * edited source the same way.
 */
export function CommentCard({
  editing,
  author,
  action,
  verdict,
  createdAt,
  lastEditedAt,
  url,
  body,
  emptyText,
  canEdit,
  toEdit,
  reactable,
  bare = false,
  footer,
}: CommentCardProps): ReactNode {
  const sendEdit = useSendEdit(editing);
  const draftKey = `edit:${reactable.id}`;
  // an edit left unsent on an earlier visit opens again on its draft
  const hasDraft = useHasDraftText(draftKey);
  const [editorOpen, setEditorOpen] = useState(hasDraft);
  const empty = body.trim() === "";

  const content = (
    <>
      <CardHeader
        author={author}
        verdict={verdict}
        action={action}
        createdAt={createdAt}
        url={url}
        edited={
          <EditedLink
            pullRequest={editing.pullRequest}
            subjectId={reactable.id}
            lastEditedAt={lastEditedAt}
            url={url}
          />
        }
        onEdit={
          canEdit && !editorOpen
            ? () => {
                setEditorOpen(true);
              }
            : null
        }
      />
      {editorOpen ? (
        <BodyEditor
          editing={editing}
          draftKey={draftKey}
          initial={body}
          ariaLabel="Edit"
          toEdit={toEdit}
          onDone={() => {
            setEditorOpen(false);
          }}
        />
      ) : null}
      {!editorOpen && !empty ? (
        <MarkdownText
          github
          text={body}
          onTaskToggle={
            canEdit
              ? async (nextText) => {
                  await sendEdit(toEdit(nextText));
                }
              : undefined
          }
        />
      ) : null}
      {!editorOpen && empty && emptyText !== undefined ? (
        <Text className="text-sm text-muted">{emptyText}</Text>
      ) : null}
      {editorOpen ? null : footer}
      {editorOpen ? null : (
        <PullRequestReactions
          subject={reactable}
          onEdit={(edit) => sendEdit(edit)}
        />
      )}
    </>
  );

  if (bare) return <View className="min-w-0 gap-xs">{content}</View>;
  return <Box className="surface min-w-0 gap-sm p-m">{content}</Box>;
}
