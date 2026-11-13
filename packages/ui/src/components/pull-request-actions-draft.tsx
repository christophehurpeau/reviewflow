import type { PullRequestEdit } from "@reviewflow/sdk";
import { ActionButton, Text, View } from "alouette";
import type { ReactNode } from "react";
import { errorToMessage } from "../services/errorToMessage.ts";
import type { PullRequestActionProps } from "./pull-request-actions-review.tsx";

/**
 * On a draft, what stands before a review is the operator's own move: say so,
 * and offer it when GitHub lets the viewer take it. Nothing on any other state.
 */
export function PullRequestReadyForReview({
  detail,
  onEdit,
}: PullRequestActionProps): ReactNode {
  const { pullRequest } = detail;
  if (pullRequest.state !== "draft") return null;
  if (!pullRequest.viewerCanUpdate) {
    return (
      <Text className="text-sm">
        This pull request is still a work in progress.
      </Text>
    );
  }

  return (
    <View className="items-start gap-xs">
      <Text className="text-sm">
        This pull request is still a work in progress.
      </Text>
      <ActionButton
        text="Ready for review"
        accent="brand"
        variant="tonal"
        size="sm"
        errorToMessage={errorToMessage}
        onPress={async () => {
          const edit: PullRequestEdit = { kind: "draft", draft: false };
          await onEdit(edit);
        }}
      />
    </View>
  );
}

/** Where GitHub puts it: under the reviewers, the rare way back. */
export function PullRequestConvertToDraft({
  detail,
  onEdit,
}: PullRequestActionProps): ReactNode {
  const { pullRequest } = detail;
  if (pullRequest.state !== "open" || !pullRequest.viewerCanUpdate) return null;
  return (
    <View className="flex-row flex-wrap items-center gap-xs">
      <Text className="text-xs text-muted">Still in progress?</Text>
      <ActionButton
        text="Convert to draft"
        accent="neutral"
        variant="tonal"
        size="sm"
        errorToMessage={errorToMessage}
        onPress={async () => {
          const edit: PullRequestEdit = { kind: "draft", draft: true };
          await onEdit(edit);
        }}
      />
    </View>
  );
}
