import type {
  PullRequestCommittingMergeMethod,
  PullRequestDetail,
  PullRequestMergeCommitMessage,
  PullRequestMergeMethod,
  PullRequestMergeState,
} from "@reviewflow/sdk";
import {
  ActionButton,
  Button,
  FormItem,
  InputText,
  QuestionAlertDialog,
  SplitButton,
  SplitButtonOption,
  Text,
  TextArea,
  View,
} from "alouette";
import type { ReactNode } from "react";
import { useState } from "react";
import { errorToMessage } from "../services/errorToMessage.ts";
import type { PullRequestActionProps } from "./pull-request-actions-review.tsx";

const isMergeMethod = (value: string): value is PullRequestMergeMethod =>
  value === "merge" || value === "squash" || value === "rebase";

const mergeMethodLabel = (method: PullRequestMergeMethod): string => {
  if (method === "squash") return "Squash and merge";
  if (method === "rebase") return "Rebase and merge";
  return "Create a merge commit";
};

/** null: GitHub would take the merge. `unstable` is non-required checks failing. */
const mergeBlockReason = (state: PullRequestMergeState): string | null => {
  switch (state) {
    case "clean":
    case "hasHooks":
    case "unstable":
      return null;
    case "behind":
      return "The branch is behind its base: update it first.";
    case "blocked":
      return "Blocked: required reviews or checks are missing.";
    case "dirty":
      return "The branch has conflicts that must be resolved.";
    case "draft":
      return "A draft cannot be merged.";
    case "unknown":
      return "GitHub is still computing mergeability: refresh in a moment.";
    default: {
      const unhandled: never = state;
      return unhandled;
    }
  }
};

interface MergeButtonProps {
  mergeMethods: readonly PullRequestMergeMethod[];
  method: PullRequestMergeMethod | undefined;
  blockReason: string | null;
  onMethodChange: (method: PullRequestMergeMethod) => void;
  onPress: () => void;
}

/**
 * `SplitButton` has no `disabledReason`: the Status says why anyway, so only
 * the single-method `Button` carries it.
 */
function MergeButton({
  mergeMethods,
  method,
  blockReason,
  onMethodChange,
  onPress,
}: MergeButtonProps): ReactNode {
  if (method === undefined || mergeMethods.length < 2) {
    return (
      <Button
        text={method === undefined ? "Merge" : mergeMethodLabel(method)}
        accent="success"
        variant="tonal"
        size="sm"
        disabledReason={blockReason}
        onPress={onPress}
      />
    );
  }

  return (
    <SplitButton
      menuLabel="Merge method"
      value={method}
      accent="success"
      variant="tonal"
      size="sm"
      disabled={blockReason !== null}
      onValueChange={(next) => {
        if (isMergeMethod(next)) onMethodChange(next);
      }}
      onPress={onPress}
    >
      {mergeMethods.includes("merge") ? (
        <SplitButtonOption value="merge" label={mergeMethodLabel("merge")} />
      ) : null}
      {mergeMethods.includes("squash") ? (
        <SplitButtonOption value="squash" label={mergeMethodLabel("squash")} />
      ) : null}
      {mergeMethods.includes("rebase") ? (
        <SplitButtonOption value="rebase" label={mergeMethodLabel("rebase")} />
      ) : null}
    </SplitButton>
  );
}

const pullRequestBlockReason = (
  pullRequest: PullRequestDetail,
): string | null =>
  pullRequest.mergeMethods.length === 0
    ? "The repository allows no merge method."
    : mergeBlockReason(pullRequest.mergeState);

/**
 * GitHub's merge box, the part read rather than pressed, for the Status: why
 * the merge is refused, and Update branch when the base moved. `blocked` is
 * left out: the checks and conversations listed beside it are the reason.
 */
export function PullRequestMergeStatus({
  detail,
  onEdit,
}: PullRequestActionProps): ReactNode {
  const { pullRequest } = detail;
  if (pullRequest.state !== "open") return null;

  const blockReason =
    pullRequest.mergeState === "blocked"
      ? null
      : pullRequestBlockReason(pullRequest);
  const unstable = pullRequest.mergeState === "unstable";
  const canUpdateBranch =
    pullRequest.viewerCanUpdateBranch || pullRequest.mergeState === "behind";
  if (blockReason === null && !unstable && !canUpdateBranch) return null;

  return (
    <View className="items-start gap-xs">
      {blockReason === null ? null : (
        <Text className="text-xs text-muted">{blockReason}</Text>
      )}
      {unstable ? (
        <Text className="text-xs text-muted">
          Some checks that are not required are failing.
        </Text>
      ) : null}
      {canUpdateBranch ? (
        <ActionButton
          text="Update branch"
          accent="neutral"
          variant="tonal"
          size="sm"
          errorToMessage={errorToMessage}
          onPress={async () => {
            await onEdit({
              kind: "updateBranch",
              expectedHeadSha: pullRequest.headSha,
            });
          }}
        />
      ) : null}
    </View>
  );
}

const isCommittingMergeMethod = (
  method: PullRequestMergeMethod,
): method is PullRequestCommittingMergeMethod => method !== "rebase";

interface CommitMessageDraft {
  prefilled: PullRequestMergeCommitMessage;
  draft: PullRequestMergeCommitMessage;
}

const editedCommitMessage = (
  commit: CommitMessageDraft | null,
): PullRequestMergeCommitMessage | undefined => {
  if (commit === null) return undefined;
  const { prefilled, draft } = commit;
  if (draft.title === prefilled.title && draft.body === prefilled.body) {
    return undefined;
  }
  return draft;
};

interface MergeCommitMessageFieldsProps {
  value: PullRequestMergeCommitMessage;
  onChange: (value: PullRequestMergeCommitMessage) => void;
}

function MergeCommitMessageFields({
  value,
  onChange,
}: MergeCommitMessageFieldsProps): ReactNode {
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
            value={value.title}
            onChangeText={(title) => {
              onChange({ ...value, title });
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
            numberOfLines={6}
            onChangeText={(body) => {
              onChange({ ...value, body });
            }}
          />
        )}
      />
    </View>
  );
}

/**
 * The merge itself: a method among what the repository allows, behind a
 * confirmation. The button is an affordance read from a state that may be
 * stale; GitHub's refusal, with the head sha the screen saw, is the guard.
 * The confirmation shows the commit GitHub would write, sent only when edited
 * so that an untouched one stays GitHub's own.
 */
export function PullRequestMergeButton({
  detail,
  onEdit,
}: PullRequestActionProps): ReactNode {
  const { pullRequest } = detail;
  const [chosen, setChosen] = useState<PullRequestMergeMethod | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [commit, setCommit] = useState<CommitMessageDraft | null>(null);
  if (pullRequest.state !== "open") return null;

  const { mergeMethods } = pullRequest;
  const method =
    chosen !== null && mergeMethods.includes(chosen) ? chosen : mergeMethods[0];

  return (
    <>
      <MergeButton
        mergeMethods={mergeMethods}
        method={method}
        blockReason={pullRequestBlockReason(pullRequest)}
        onMethodChange={setChosen}
        onPress={() => {
          if (method === undefined) return;
          const prefilled = isCommittingMergeMethod(method)
            ? pullRequest.mergeCommitMessages[method]
            : null;
          setCommit(
            prefilled === null ? null : { prefilled, draft: prefilled },
          );
          setConfirming(true);
        }}
      />
      {method === undefined ? null : (
        <QuestionAlertDialog
          visible={confirming}
          accent="success"
          title="Merge this pull request?"
          confirmText={mergeMethodLabel(method)}
          confirmDisabled={commit !== null && commit.draft.title.trim() === ""}
          errorToMessage={errorToMessage}
          onConfirm={async () => {
            const commitMessage = editedCommitMessage(commit);
            await onEdit({
              kind: "merge",
              method,
              expectedHeadSha: pullRequest.headSha,
              ...(commitMessage === undefined ? {} : { commitMessage }),
            });
            setConfirming(false);
          }}
          onCancel={() => {
            setConfirming(false);
          }}
        >
          <View className="gap-m">
            <Text>
              {`#${String(pullRequest.number)} goes into ${pullRequest.baseRef} on GitHub, under your login.`}
            </Text>
            {commit === null ? null : (
              <MergeCommitMessageFields
                value={commit.draft}
                onChange={(draft) => {
                  setCommit({ ...commit, draft });
                }}
              />
            )}
          </View>
        </QuestionAlertDialog>
      )}
    </>
  );
}

/** Closing is under the comment box, since it requires saying why. */
export function PullRequestReopen({
  detail,
  onEdit,
}: PullRequestActionProps): ReactNode {
  const { pullRequest } = detail;
  if (!pullRequest.viewerCanUpdate || pullRequest.state !== "closed") {
    return null;
  }

  return (
    <ActionButton
      text="Reopen pull request"
      accent="neutral"
      variant="tonal"
      size="sm"
      errorToMessage={errorToMessage}
      onPress={async () => {
        await onEdit({ kind: "state", state: "open" });
      }}
    />
  );
}
