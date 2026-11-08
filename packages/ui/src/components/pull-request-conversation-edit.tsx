import type { PullRequestDetail, PullRequestEdit } from "@reviewflow/sdk";
import { ActionButton, Button, Text, View } from "alouette";
import type { ReactNode } from "react";
import { usePullRequestDataSource } from "../dataSource.ts";
import { useDraftText } from "../services/PullRequestDraftsProvider.tsx";
import { errorToMessage } from "../services/errorToMessage.ts";
import { PullRequestMarkdownInput } from "./pull-request-markdown-input.tsx";

/** What every gesture of the conversation needs to write and to re-read. */
export interface ConversationEditing {
  pullRequest: PullRequestDetail;
  /** reads again the parts of the pull request the change made stale */
  onEdited: (edit: PullRequestEdit) => Promise<void>;
}

/** Writes the edit through the data source, then reads again what it made stale. */
export const useSendEdit = ({
  pullRequest,
  onEdited,
}: ConversationEditing): ((edit: PullRequestEdit) => Promise<void>) => {
  const { edit: writeEdit } = usePullRequestDataSource();
  return async (edit) => {
    await writeEdit(pullRequest, edit);
    await onEdited(edit);
  };
};

interface BodyEditorProps {
  editing: ConversationEditing;
  /** where the edit in progress is kept, see `useDraftText` */
  draftKey: string;
  initial: string;
  ariaLabel: string;
  toEdit: (body: string) => PullRequestEdit;
  onDone: () => void;
}

/** The inline editor of a description or a comment: the source, with its preview. */
export function BodyEditor({
  editing,
  draftKey,
  initial,
  ariaLabel,
  toEdit,
  onDone,
}: BodyEditorProps): ReactNode {
  const sendEdit = useSendEdit(editing);
  const draft = useDraftText(draftKey, initial);
  return (
    <View className="gap-xs">
      <PullRequestMarkdownInput
        aria-label={ariaLabel}
        value={draft.text}
        onChange={draft.setText}
      />
      <View className="flex-row flex-wrap items-center justify-end gap-xs">
        <Button
          text="Cancel"
          accent="neutral"
          variant="soft"
          size="sm"
          onPress={() => {
            draft.discard();
            onDone();
          }}
        />
        <ActionButton
          text="Save"
          accent="brand"
          variant="tonal"
          size="sm"
          errorToMessage={errorToMessage}
          onPress={async () => {
            const sent = draft.text;
            await sendEdit(toEdit(sent));
            draft.discard(sent);
            onDone();
          }}
        />
      </View>
    </View>
  );
}

export interface ComposerDraft {
  body: string;
  clear: () => void;
}

interface ComposerProps {
  editing: ConversationEditing;
  /** where the text being written is kept, see `useDraftText` */
  draftKey: string;
  title?: string;
  ariaLabel: string;
  buttonText: string;
  toEdit: (body: string) => PullRequestEdit;
  /** before the submit button, e.g. Resolve under a reply */
  extraActions?: (draft: ComposerDraft) => ReactNode;
}

/** A new comment or a reply: cleared once GitHub took it, kept when it refused. */
export function Composer({
  editing,
  draftKey,
  title,
  ariaLabel,
  buttonText,
  toEdit,
  extraActions,
}: ComposerProps): ReactNode {
  const sendEdit = useSendEdit(editing);
  const draft = useDraftText(draftKey);
  return (
    <View className="gap-xs">
      {title === undefined ? null : (
        <Text className="font-body-bold text-sm">{title}</Text>
      )}
      <PullRequestMarkdownInput
        aria-label={ariaLabel}
        value={draft.text}
        onChange={draft.setText}
      />
      <View className="flex-row flex-wrap items-center justify-end gap-xs">
        {extraActions?.({
          body: draft.text,
          clear: () => {
            draft.discard();
          },
        })}
        <ActionButton
          text={buttonText}
          accent="brand"
          variant="tonal"
          size="sm"
          disabled={draft.text.trim() === ""}
          errorToMessage={errorToMessage}
          onPress={async () => {
            const sent = draft.text;
            await sendEdit(toEdit(sent));
            draft.discard(sent);
          }}
        />
      </View>
    </View>
  );
}
