import type { Probot } from "probot";
import { recordPrActivity } from "reviewflow-core";
import type { AppContext } from "../../context/AppContext.ts";

interface DatedComment {
  created_at: string;
  updated_at: string;
}

const getCommentActivityAt = (
  action: "created" | "deleted" | "edited",
  comment: DatedComment,
): Date => {
  if (action === "created") return new Date(comment.created_at);
  if (action === "edited") return new Date(comment.updated_at);
  return new Date();
};

/**
 * Dates every comment and description change, this bot's own included. Its
 * own edits are dated when it makes them; their echo only covers what was
 * missed.
 */
export default function activityFlowDates(
  app: Probot,
  appContext: AppContext,
): void {
  app.on(
    ["issue_comment.created", "issue_comment.edited", "issue_comment.deleted"],
    async ({ payload }) => {
      if (!payload.issue.pull_request) return;
      await recordPrActivity(appContext.mongoStores, {
        accountId: payload.repository.owner.id,
        repoId: payload.repository.id,
        number: payload.issue.number,
        flowDate: "lastCommentActivityAt",
        at: getCommentActivityAt(payload.action, payload.comment),
      });
    },
  );

  app.on(
    [
      "pull_request_review_comment.created",
      "pull_request_review_comment.edited",
      "pull_request_review_comment.deleted",
    ],
    async ({ payload }) => {
      await recordPrActivity(appContext.mongoStores, {
        accountId: payload.repository.owner.id,
        repoId: payload.repository.id,
        number: payload.pull_request.number,
        flowDate: "lastReviewCommentActivityAt",
        at: getCommentActivityAt(payload.action, payload.comment),
      });
    },
  );

  app.on("pull_request.edited", async ({ payload }) => {
    if (!payload.changes.body) return;
    await recordPrActivity(appContext.mongoStores, {
      accountId: payload.repository.owner.id,
      repoId: payload.repository.id,
      number: payload.pull_request.number,
      flowDate: "lastBodyEditedAt",
      at: new Date(payload.pull_request.updated_at),
    });
  });
}
