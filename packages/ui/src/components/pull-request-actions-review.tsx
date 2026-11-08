import type {
  PullRequestDetailResponse,
  PullRequestEdit,
  PullRequestReviewEvent,
} from "@reviewflow/sdk";
import {
  ActionButton,
  Button,
  Code,
  IconButton,
  Modal,
  Radio,
  RadioGroup,
  Text,
  View,
} from "alouette";
import { XRegularIcon } from "alouette-icons/phosphor-icons/X";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  useDraftText,
  usePullRequestDrafts,
} from "../services/PullRequestDraftsProvider.tsx";
import { usePullRequestReviewDraft } from "../services/PullRequestReviewDraftProvider.tsx";
import { errorToMessage } from "../services/errorToMessage.ts";
import { PullRequestMarkdownInput } from "./pull-request-markdown-input.tsx";

export interface PullRequestActionProps {
  detail: PullRequestDetailResponse;
  /** sends one edit, then reads the pull request again */
  onEdit: (edit: PullRequestEdit) => Promise<void>;
}

const isReviewEvent = (value: string): value is PullRequestReviewEvent =>
  value === "comment" || value === "approve" || value === "requestChanges";

const firstLine = (body: string): string => body.split("\n")[0] ?? "";

/** What GitHub would refuse, said before the press rather than after. */
const submitBlocker = (
  event: PullRequestReviewEvent,
  body: string,
  commentCount: number,
): string | null => {
  const empty = body.trim() === "";
  if (event === "requestChanges" && empty) {
    return "Requesting changes needs a summary.";
  }
  if (event === "comment" && empty && commentCount === 0) {
    return "A comment review needs a summary or at least one inline comment.";
  }
  return null;
};

/**
 * "Review changes", ending the Files changed tab's sticky toolbar: the verdict, a
 * summary and the inline comments the diff collected, sent as one review.
 * Brand while comments are pending, so an unsent review is not forgotten. Never
 * offered to the author, whom GitHub lets comment but not review. A review
 * pinned to a head since replaced only comments: a verdict is given on the
 * code as it stands, which the server checks too.
 */
export function PullRequestReviewButton({
  detail,
  onEdit,
}: PullRequestActionProps): ReactNode {
  const { pullRequest } = detail;
  const { comments, remove, clear, shas, latest, follow } =
    usePullRequestReviewDraft();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<PullRequestReviewEvent>("comment");
  const drafts = usePullRequestDrafts();
  const summary = useDraftText("review:body");
  const body = summary.text;
  const headMoved =
    shas !== null && latest !== null && shas.head !== latest.head;
  const event = headMoved ? "comment" : chosen;
  const blocker = submitBlocker(event, body, comments.length);

  return (
    <>
      <Button
        text={
          comments.length === 0
            ? "Review changes"
            : `Review changes (${String(comments.length)})`
        }
        accent={comments.length === 0 ? "neutral" : "brand"}
        variant="tonal"
        size="sm"
        onPress={() => {
          setOpen(true);
        }}
      />
      <Modal
        visible={open}
        title="Review changes"
        size="lg"
        accent="brand"
        footer={
          <>
            <Button
              text="Cancel"
              accent="neutral"
              variant="soft"
              onPress={() => {
                setOpen(false);
              }}
            />
            <ActionButton
              text="Submit review"
              accent="brand"
              variant="tonal"
              disabledReason={blocker}
              errorMessageVariant="flat"
              errorToMessage={errorToMessage}
              onPress={async () => {
                await onEdit({
                  kind: "review",
                  event,
                  body,
                  commitId: shas?.head ?? pullRequest.headSha,
                  comments: comments.map(
                    ({ key: _key, ...comment }) => comment,
                  ),
                });
                clear();
                summary.discard(body);
                setChosen("comment");
                setOpen(false);
              }}
            />
          </>
        }
        onClose={() => {
          setOpen(false);
        }}
      >
        <View className="gap-m">
          <PullRequestMarkdownInput
            aria-label="Review summary"
            value={body}
            onChange={summary.setText}
          />
          {/* TODO: rows stretch to the full width once alouette allows it: https://github.com/christophehurpeau/alouette/issues/397 */}
          <RadioGroup
            aria-label="Verdict"
            value={event}
            onValueChange={(next) => {
              if (isReviewEvent(next)) setChosen(next);
            }}
          >
            <Radio value="comment" label="Comment" />
            <Radio value="approve" label="Approve" disabled={headMoved} />
            <Radio
              value="requestChanges"
              label="Request changes"
              disabled={headMoved}
            />
          </RadioGroup>
          {headMoved && follow === null ? (
            <Text className="text-sm text-muted">
              New commits were pushed since this review started: it can only
              comment. Approve or request changes once it is sent, on the latest
              version.
            </Text>
          ) : null}
          {headMoved && follow !== null ? (
            <Text className="text-sm text-muted">
              New commits were pushed since this diff was shown: this review can
              only comment. Show the latest changes to approve or request
              changes.
            </Text>
          ) : null}
          {blocker === null ? null : (
            <Text className="text-sm text-muted">{blocker}</Text>
          )}
          <View className="gap-xs">
            <Text className="font-body-bold text-sm">
              {`Inline comments (${String(comments.length)})`}
            </Text>
            {comments.length === 0 ? (
              <Text className="text-sm text-muted">
                None. Add them from the Files changed tab.
              </Text>
            ) : (
              comments.map((comment) => (
                <View
                  key={comment.key}
                  className="flex-row items-center gap-xs"
                >
                  <Code className="text-sm">{`${comment.path}:${String(comment.line)}`}</Code>
                  <Text className="min-w-0 flex-1 text-sm" numberOfLines={1}>
                    {firstLine(comment.body)}
                  </Text>
                  <IconButton
                    icon={<XRegularIcon />}
                    aria-label={`Remove the comment on ${comment.path}:${String(comment.line)}`}
                    variant="soft"
                    size="sm"
                    onPress={() => {
                      remove(comment.key);
                    }}
                  />
                </View>
              ))
            )}
          </View>
          <Text className="text-xs text-muted">
            {drafts === null
              ? "Pending comments live in memory until the review is sent: reloading or leaving this pull request drops them."
              : `Pending comments and the summary are kept on this device until the review is sent, for ${String(drafts.retentionDays)} days after their last change.`}
          </Text>
        </View>
      </Modal>
    </>
  );
}
