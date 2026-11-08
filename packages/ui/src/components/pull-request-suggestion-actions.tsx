import {
  parseSuggestions,
  suggestionCommitRefusal,
  suggestionRangesOverlap,
} from "@reviewflow/sdk";
import type {
  PullRequestComment,
  PullRequestSuggestionRef,
  PullRequestThread,
} from "@reviewflow/sdk";
import {
  Button,
  FormItem,
  InputText,
  QuestionAlertDialog,
  Text,
  TextArea,
  View,
} from "alouette";
import type { ReactNode } from "react";
import { useState } from "react";
import type {
  BatchedSuggestion,
  SuggestionCommitMessage,
} from "../services/PullRequestSuggestionBatchProvider.tsx";
import { useSuggestionBatch } from "../services/PullRequestSuggestionBatchProvider.tsx";
import { errorToMessage } from "../services/errorToMessage.ts";

const defaultHeadline = (count: number): string =>
  count === 1
    ? "Apply suggestion from code review"
    : "Apply suggestions from code review";

interface CommitMessageFieldsProps {
  value: SuggestionCommitMessage;
  onChange: (value: SuggestionCommitMessage) => void;
}

function CommitMessageFields({
  value,
  onChange,
}: CommitMessageFieldsProps): ReactNode {
  return (
    <View className="gap-m">
      <FormItem
        label="Commit message"
        render={({ labelId, describedBy, invalid, required }) => (
          <InputText
            aria-labelledby={labelId}
            aria-describedby={describedBy}
            aria-required={required}
            invalid={invalid}
            value={value.headline}
            onChangeText={(headline) => {
              onChange({ ...value, headline });
            }}
          />
        )}
      />
      <FormItem
        label="Extended description"
        render={({ labelId, describedBy, invalid, required }) => (
          <TextArea
            aria-labelledby={labelId}
            aria-describedby={describedBy}
            aria-required={required}
            invalid={invalid}
            value={value.body}
            numberOfLines={4}
            onChangeText={(body) => {
              onChange({ ...value, body });
            }}
          />
        )}
      />
    </View>
  );
}

interface SuggestionActionsProps {
  thread: PullRequestThread;
  comment: PullRequestComment;
}

/**
 * Commit a comment's suggestion, alone or with the batch. The refusal shown
 * on the buttons is read from the screen's last read; the daemon checks
 * GitHub's current state again before committing.
 */
export function SuggestionActions({
  thread,
  comment,
}: SuggestionActionsProps): ReactNode {
  const batch = useSuggestionBatch();
  const [message, setMessage] = useState<SuggestionCommitMessage | null>(null);
  const [committing, setCommitting] = useState<PullRequestSuggestionRef[]>([]);
  const suggestionCount = parseSuggestions(comment.body).length;
  if (batch === null || suggestionCount === 0) return null;

  const { pullRequest } = batch;
  const refusal = suggestionCommitRefusal({
    state: pullRequest.state,
    viewerCanApplySuggestion: pullRequest.viewerCanApplySuggestion,
    suggestionCount,
    outdated: thread.outdated,
    line: thread.line,
    side: thread.side,
    startSide: thread.startSide,
  });
  const own: BatchedSuggestion | null =
    refusal !== null || thread.line === null
      ? null
      : {
          threadId: thread.id,
          commentId: comment.id,
          path: thread.path,
          startLine: thread.startLine,
          line: thread.line,
        };
  const inBatch = batch.batch.some(({ commentId }) => commentId === comment.id);
  const addRefusal = ((): string | undefined => {
    if (own === null) return refusal ?? undefined;
    if (batch.batch.some((batched) => suggestionRangesOverlap(batched, own))) {
      return "A suggestion of the batch already replaces these lines";
    }
    return undefined;
  })();
  const toCommit = batch.batch.length > 0 || own === null ? batch.batch : [own];

  const open = (): void => {
    if (toCommit.length === 0) return;
    setCommitting(toCommit);
    setMessage({ headline: defaultHeadline(toCommit.length), body: "" });
  };

  return (
    <View className="flex-row flex-wrap items-center justify-end gap-xs">
      {inBatch ? (
        <Button
          size="sm"
          accent="neutral"
          variant="soft"
          text="Remove from batch"
          onPress={() => {
            batch.remove(comment.id);
          }}
        />
      ) : (
        <Button
          size="sm"
          accent="neutral"
          text="Add suggestion to batch"
          disabledReason={addRefusal}
          onPress={() => {
            if (own !== null) batch.add(own);
          }}
        />
      )}
      <Button
        size="sm"
        text={
          batch.batch.length === 0
            ? "Commit suggestion"
            : `Commit ${String(batch.batch.length)} suggestion${batch.batch.length === 1 ? "" : "s"}`
        }
        disabledReason={
          toCommit.length === 0 ? (refusal ?? undefined) : undefined
        }
        onPress={open}
      />
      <QuestionAlertDialog
        visible={message !== null}
        title={
          committing.length === 1
            ? "Commit this suggestion?"
            : `Commit ${String(committing.length)} suggestions?`
        }
        confirmText="Commit changes"
        confirmDisabled={message === null || message.headline.trim() === ""}
        errorToMessage={errorToMessage}
        onConfirm={async () => {
          if (message === null) return;
          await batch.commit(committing, message);
          setMessage(null);
        }}
        onCancel={() => {
          setMessage(null);
        }}
      >
        <View className="gap-m">
          <Text>
            {`One commit on ${pullRequest.headRef}, on GitHub, under your login.`}
          </Text>
          {message === null ? null : (
            <CommitMessageFields value={message} onChange={setMessage} />
          )}
        </View>
      </QuestionAlertDialog>
    </View>
  );
}
