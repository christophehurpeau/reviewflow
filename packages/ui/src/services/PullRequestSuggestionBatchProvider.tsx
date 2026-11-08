import type {
  PullRequestDetail,
  PullRequestEdit,
  PullRequestSuggestionRef,
  SuggestionRange,
} from "@reviewflow/sdk";
import { View, WarningMessage } from "alouette";
import type { ReactNode } from "react";
import { createContext, use, useMemo, useState } from "react";
import { usePullRequestDataSource } from "../dataSource.ts";

export type BatchedSuggestion = PullRequestSuggestionRef & SuggestionRange;

export interface SuggestionCommitMessage {
  headline: string;
  body: string;
}

interface PullRequestSuggestionBatch {
  pullRequest: PullRequestDetail;
  batch: BatchedSuggestion[];
  add: (suggestion: BatchedSuggestion) => void;
  remove: (commentId: string) => void;
  /** one commit for `suggestions`, then the batch is emptied */
  commit: (
    suggestions: PullRequestSuggestionRef[],
    message: SuggestionCommitMessage,
  ) => Promise<void>;
}

const SuggestionBatchContext = createContext<PullRequestSuggestionBatch | null>(
  null,
);

interface PullRequestSuggestionBatchProviderProps {
  pullRequest: PullRequestDetail;
  onEdited: (edit: PullRequestEdit) => Promise<void>;
  children: ReactNode;
}

/**
 * The suggestions gathered to be committed together, as GitHub's "Add
 * suggestion to batch". In memory, per pull request: a reload drops the
 * batch, which commits nothing until pressed.
 *
 * The commit lands even when resolving its threads afterwards fails; that
 * failure is shown here, above the tabs, since the button that committed may
 * be gone with its thread.
 */
export function PullRequestSuggestionBatchProvider({
  pullRequest,
  onEdited,
  children,
}: PullRequestSuggestionBatchProviderProps): ReactNode {
  const [batch, setBatch] = useState<BatchedSuggestion[]>([]);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const { edit: writeEdit } = usePullRequestDataSource();

  const value = useMemo<PullRequestSuggestionBatch>(
    () => ({
      pullRequest,
      batch,
      add: (suggestion) => {
        setBatch((previous) => [...previous, suggestion]);
      },
      remove: (commentId) => {
        setBatch((previous) =>
          previous.filter((suggestion) => suggestion.commentId !== commentId),
        );
      },
      commit: async (suggestions, { headline, body }) => {
        const edit: PullRequestEdit = {
          kind: "applySuggestions",
          expectedHeadSha: pullRequest.headSha,
          suggestions: suggestions.map(({ threadId, commentId }) => ({
            threadId,
            commentId,
          })),
          headline,
          body,
        };
        const response = await writeEdit(pullRequest, edit);
        setBatch([]);
        setFollowUpError(response.followUpError);
        await onEdited(edit);
      },
    }),
    [pullRequest, batch, onEdited, writeEdit],
  );

  return (
    <SuggestionBatchContext value={value}>
      <View className="gap-m">
        {followUpError === null ? null : (
          <WarningMessage
            dismissIconAriaLabel="Dismiss"
            onDismiss={() => {
              setFollowUpError(null);
            }}
          >
            {followUpError}
          </WarningMessage>
        )}
        {children}
      </View>
    </SuggestionBatchContext>
  );
}

/** Null outside a pull request screen: its suggestions are not committable there. */
export const useSuggestionBatch = (): PullRequestSuggestionBatch | null =>
  use(SuggestionBatchContext);
