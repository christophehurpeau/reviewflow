import { ActionButton } from "alouette";
import type { ReactNode } from "react";
import { errorToMessage } from "#/errorToMessage.ts";

interface StartReviewButtonProps {
  /** must reject on failure: ActionButton renders the message itself */
  onStartReview: () => Promise<void>;
}

export function StartReviewButton({
  onStartReview,
}: StartReviewButtonProps): ReactNode {
  return (
    <ActionButton
      text="Start review"
      size="sm"
      variant="outlined"
      // the whole row opens github, so the button must keep the press
      onPress={(event) => {
        event.stopPropagation();
        return onStartReview();
      }}
      errorToMessage={errorToMessage}
      // the row is already a raised surface, so the failure message is flat
      errorMessageVariant="flat"
    />
  );
}
