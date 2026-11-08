import { pullRequestReactionContents } from "@reviewflow/sdk";
import type {
  PullRequestEdit,
  PullRequestReactable,
  PullRequestReaction,
  PullRequestReactionContent,
} from "@reviewflow/sdk";
import {
  ActionButton,
  ErrorMessage,
  IconButton,
  Menu,
  MenuItem,
  View,
} from "alouette";
import { SmileyRegularIcon } from "alouette-icons/phosphor-icons/Smiley";
import type { ReactNode } from "react";
import { useState } from "react";
import { errorToMessage } from "../services/errorToMessage.ts";

const reactionEmoji: Record<PullRequestReactionContent, string> = {
  thumbsUp: "👍",
  thumbsDown: "👎",
  laugh: "😄",
  hooray: "🎉",
  confused: "😕",
  heart: "❤️",
  rocket: "🚀",
  eyes: "👀",
};

/** GitHub's own names, the ones its picker shows. */
const reactionName: Record<PullRequestReactionContent, string> = {
  thumbsUp: "+1",
  thumbsDown: "-1",
  laugh: "laugh",
  hooray: "hooray",
  confused: "confused",
  heart: "heart",
  rocket: "rocket",
  eyes: "eyes",
};

type ToggleReaction = (
  content: PullRequestReactionContent,
  reacted: boolean,
) => Promise<void>;

interface ReactionButtonProps {
  reaction: PullRequestReaction;
  viewerCanReact: boolean;
  toggle: ToggleReaction;
}

function ReactionButton({
  reaction,
  viewerCanReact,
  toggle,
}: ReactionButtonProps): ReactNode {
  const { content, count, viewerHasReacted } = reaction;
  const people = count === 1 ? "1 person" : `${String(count)} people`;
  return (
    <ActionButton
      text={`${reactionEmoji[content]} ${String(count)}`}
      aria-label={`${reactionName[content]}: ${people}${viewerHasReacted ? ", you included" : ""}`}
      accent={viewerHasReacted ? "brand" : "neutral"}
      variant="tonal"
      size="sm"
      disabledReason={
        viewerCanReact ? null : "GitHub does not let you react here"
      }
      errorMessageVariant="flat"
      errorToMessage={errorToMessage}
      onPress={async () => {
        await toggle(content, !viewerHasReacted);
      }}
    />
  );
}

interface ReactionPickerProps {
  reactions: PullRequestReaction[];
  toggle: ToggleReaction;
  onError: (message: string | null) => void;
}

function ReactionPicker({
  reactions,
  toggle,
  onError,
}: ReactionPickerProps): ReactNode {
  return (
    <Menu
      label="Reactions"
      // The trigger ends a row that starts at the card's edge: hanging the
      // panel from its end edge would push it off the left of the screen.
      align="start"
      render={(triggerProps) => (
        <IconButton
          icon={<SmileyRegularIcon />}
          aria-label="Add a reaction"
          accent="neutral"
          variant="soft"
          size="sm"
          {...triggerProps}
        />
      )}
    >
      {pullRequestReactionContents.map((content) => {
        const reacted = reactions.some(
          (reaction) =>
            reaction.content === content && reaction.viewerHasReacted,
        );
        return (
          <MenuItem
            key={content}
            label={`${reactionEmoji[content]} ${reactionName[content]}`}
            description={reacted ? "Yours: press to remove it" : undefined}
            accent={reacted ? "brand" : undefined}
            onPress={() => {
              onError(null);
              toggle(content, !reacted).catch((error: unknown) => {
                onError(errorToMessage(error));
              });
            }}
          />
        );
      })}
    </Menu>
  );
}

interface PullRequestReactionsProps {
  subject: PullRequestReactable;
  onEdit: (edit: PullRequestEdit) => Promise<void>;
}

/**
 * GitHub's reactions under a description, a comment or a review: a count per
 * emoji someone gave, pressed to add or take back the viewer's own, and the
 * picker for the others. Written on the press, then read back from GitHub.
 */
export function PullRequestReactions({
  subject,
  onEdit,
}: PullRequestReactionsProps): ReactNode {
  const [pickerError, setPickerError] = useState<string | null>(null);
  const { id, reactions, viewerCanReact } = subject;
  if (reactions.length === 0 && !viewerCanReact) return null;

  const toggle: ToggleReaction = (content, reacted) =>
    onEdit({ kind: "reaction", subjectId: id, content, reacted });

  return (
    <View className="gap-xs">
      <View className="flex-row flex-wrap items-center gap-xs">
        {reactions.map((reaction) => (
          <ReactionButton
            key={reaction.content}
            reaction={reaction}
            viewerCanReact={viewerCanReact}
            toggle={toggle}
          />
        ))}
        {viewerCanReact ? (
          <ReactionPicker
            reactions={reactions}
            toggle={toggle}
            onError={setPickerError}
          />
        ) : null}
      </View>
      {pickerError === null ? null : (
        <ErrorMessage variant="flat">{pickerError}</ErrorMessage>
      )}
    </View>
  );
}
