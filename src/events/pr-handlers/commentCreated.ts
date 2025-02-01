import type { RestEndpointMethodTypes } from "@octokit/rest";
import delay from "delay";
import type { Context, Probot } from "probot";
import type { AppContext } from "../../context/AppContext";
import type { AccountInfo } from "../../context/getOrCreateAccount";
import type { SlackMessage } from "../../context/slack/SlackMessage";
import type {
  PostSlackMessageResult,
  SlackMessageResult,
} from "../../context/slack/TeamSlack";
import type { MessageCategory } from "../../dm/MessageCategory";
import type { AccountEmbed } from "../../mongo";
import * as slackUtils from "../../slack/utils";
import { ExcludesNullish } from "../../utils/Excludes";
import {
  checkIfIsThisBot,
  checkIfUserIsBot,
} from "../../utils/github/isBotUser";
import { parseMentions } from "../../utils/github/parseMentions";
import { createSlackMessageWithSecondaryBlock } from "../../utils/slack/createSlackMessageWithSecondaryBlock";
import { slackifyCommentBody } from "../../utils/slackifyCommentBody";
import type { ProbotEvent } from "../probot-types";
import { createPullRequestHandler } from "./utils/createPullRequestHandler";
import { fetchPr } from "./utils/fetchPr";
import { getPullRequestFromPayload } from "./utils/getPullRequestFromPayload";
import { getReviewersAndReviewStates } from "./utils/getReviewersAndReviewStates";
import { getRolesFromPullRequestAndReviewers } from "./utils/getRolesFromPullRequestAndReviewers";

type Comment = ProbotEvent<
  "issue_comment.created" | "pull_request_review_comment.created"
>["payload"]["comment"];

const getDiscussion = async (
  context: Context,
  comment: Comment,
): Promise<
  | Comment[]
  | RestEndpointMethodTypes["pulls"]["listReviewComments"]["response"]["data"]
> => {
  if (!("in_reply_to_id" in comment) || !comment.in_reply_to_id) {
    return [comment];
  }
  return context.octokit.paginate(
    context.octokit.pulls.listReviewComments,
    context.pullRequest({
      sort: "created",
    }),
    ({ data }) => {
      return data.filter(
        (c) =>
          c.in_reply_to_id === comment.in_reply_to_id ||
          c.id === comment.in_reply_to_id,
      );
    },
  );
};

const getMentions = (
  discussion:
    | Comment[]
    | RestEndpointMethodTypes["pulls"]["listReviewComments"]["response"]["data"],
): string[] => {
  const mentions = new Set<string>();

  discussion.forEach((c) => {
    parseMentions(c.body).forEach((m) => mentions.add(m));
  });

  return [...mentions];
};

const getUsersInThread = (
  discussion:
    | Comment[]
    | RestEndpointMethodTypes["pulls"]["listReviewComments"]["response"]["data"],
): AccountInfo[] => {
  const userIds = new Set<number>();
  const users: AccountInfo[] = [];

  discussion.forEach((c) => {
    if (!c.user || userIds.has(c.user.id)) return;
    userIds.add(c.user.id);
    users.push({ id: c.user.id, login: c.user.login, type: c.user.type });
  });

  return users;
};

export default function prCommentCreated(
  app: Probot,
  appContext: AppContext,
): void {
  const saveInDb = async (
    type: "issue-comment" | "review-comment",
    commentId: number,
    accountEmbed: AccountEmbed,
    results: PostSlackMessageResult[],
    message: SlackMessage,
  ): Promise<void> => {
    const filtered = results.filter(ExcludesNullish);
    if (filtered.length === 0) return;

    await appContext.mongoStores.slackSentMessages.insertOne({
      type,
      typeId: commentId,
      message,
      account: accountEmbed,
      sentTo: filtered,
    });
  };

  createPullRequestHandler(
    app,
    appContext,
    [
      "pull_request_review_comment.created",
      // comments without review and without path are sent with issue_comment.created.
      // createHandlerPullRequestChange checks if pull_request event is present, removing real issues comments.
      "issue_comment.created",
    ],
    (payload, context) => {
      if (checkIfIsThisBot(payload.comment.user)) {
        // ignore comments from this bot
        return null;
      }
      return getPullRequestFromPayload(payload);
    },
    async (
      pullRequest,
      context,
      repoContext,
      reviewflowPrContext,
    ): Promise<void> => {
      const pr = await fetchPr(context, pullRequest.number);
      const prUser = pr.user;
      if (!prUser) return;
      const { comment } = context.payload;
      const isReviewComment =
        !!(comment as any).pull_request_review_id &&
        !(comment as any).in_reply_to_id;
      const type = isReviewComment ? "review-comment" : "issue-comment";

      const body = comment.body;
      if (!body) return;

      const [discussion, { reviewers }, reviewSlackMessages] =
        await Promise.all([
          getDiscussion(context, comment),
          getReviewersAndReviewStates(context),
          (comment as any).pull_request_review_id
            ? appContext.mongoStores.slackSentMessages.findAll({
                "account.id": repoContext.accountEmbed.id,
                "account.type": repoContext.accountEmbed.type,
                type: "review-submitted",
                typeId: (comment as any).pull_request_review_id,
              } as const)
            : null,
        ]);

      const { owner, assignees, followers } =
        getRolesFromPullRequestAndReviewers(pr as any, reviewers, {
          excludeIds: [comment.user.id],
        });

      const usersInThread = getUsersInThread(discussion).filter(
        (u) =>
          u.id !== prUser.id &&
          u.id !== comment.user.id &&
          !assignees.some((a) => a.id === u.id) &&
          !followers.some((f) => f.id === u.id),
      );
      const mentions = getMentions(discussion).filter(
        (m) =>
          m !== prUser.login &&
          m !== comment.user.login &&
          !assignees.some((a) => a.login === m) &&
          !followers.some((f) => f.login === m) &&
          !usersInThread.some((u) => u.login === m),
      );

      const mention = repoContext.slack.mention(comment.user.login);
      const prUrl = slackUtils.createPrLink(pr, repoContext);
      const ownerMention = repoContext.slack.mention(prUser.login);
      const commentLink = slackUtils.createLink(
        comment.html_url,
        (() => {
          if ((comment as any).in_reply_to_id) return "replied";
          return isReviewComment ? "reviewed" : "commented";
        })(),
      );
      const commentLinkPathText = slackUtils.createLink(
        comment.html_url,
        (comment as any).path,
      );

      const createMessage = (
        toOwner?: boolean,
        isAssignedTo?: boolean,
      ): string => {
        const ownerPart = toOwner
          ? "your PR"
          : `${ownerMention}'s PR${isAssignedTo ? " you're assigned to" : ""}`;
        return `:speech_balloon: ${mention} ${commentLink} on ${ownerPart} ${prUrl}`;
      };

      const slackifiedBodyBlocks = await slackifyCommentBody(
        repoContext,
        comment.body,
        (comment as any).start_line !== null,
      );

      const ownerSlackMessage = createSlackMessageWithSecondaryBlock(
        createMessage(true, false),
        isReviewComment ? undefined : slackifiedBodyBlocks,
      );
      const assignedToSlackMessage = createSlackMessageWithSecondaryBlock(
        createMessage(true, true),
        isReviewComment ? undefined : slackifiedBodyBlocks,
      );
      const notOwnerSlackMessage = createSlackMessageWithSecondaryBlock(
        createMessage(false),
        isReviewComment ? undefined : slackifiedBodyBlocks,
      );

      const threadMessage = createSlackMessageWithSecondaryBlock(
        commentLinkPathText,
        slackifiedBodyBlocks,
      );

      const isBotUser = checkIfUserIsBot(repoContext, comment.user);

      const mentioned = await (mentions.length > 0
        ? appContext.mongoStores.users.findAll({ login: { $in: mentions } })
        : []);

      const postMessageInReviewThreadOrNewMessage = async (
        category: MessageCategory,
        toUser: AccountInfo,
        threadParentMessageIfNotFound: SlackMessage,
        threadMessage: SlackMessage,
        forTeamId?: number,
      ): Promise<SlackMessageResult | null> => {
        if (isReviewComment) {
          let reviewSlackMessageTs: string | null = null;
          if (reviewSlackMessages) {
            reviewSlackMessages.forEach((reviewSlackMessage) => {
              reviewSlackMessage.sentTo.forEach((sentTo) => {
                if (
                  sentTo.user.id === toUser.id &&
                  sentTo.user.type === toUser.type
                ) {
                  reviewSlackMessageTs = sentTo.ts;
                }
              });
            });
          }

          // a comment on a file without a review, or might also be undefined if review submit is ignored
          if (!reviewSlackMessageTs) {
            const newMessage = await repoContext.slack.postMessage(
              category,
              toUser,
              threadParentMessageIfNotFound,
              forTeamId,
            );
            if (newMessage) {
              reviewSlackMessageTs = newMessage.ts;
            }
          }

          if (reviewSlackMessageTs) {
            return repoContext.slack.postMessage(
              category,
              toUser,
              { ...threadMessage, threadTs: reviewSlackMessageTs },
              forTeamId,
            );
          }
          return null;
        } else {
          return repoContext.slack.postMessage(
            category,
            toUser,
            threadParentMessageIfNotFound,
            forTeamId,
          );
        }
      };

      await Promise.all([
        Promise.all(
          assignees
            .filter((a) => a.id === owner.id)
            .map((owner) =>
              postMessageInReviewThreadOrNewMessage(
                isBotUser ? "pr-comment-bots" : "pr-comment",
                owner,
                ownerSlackMessage,
                threadMessage,
              ),
            ),
        ).then((results) =>
          saveInDb(
            type,
            comment.id,
            repoContext.accountEmbed,
            results,
            isReviewComment ? threadMessage : ownerSlackMessage,
          ),
        ),
        Promise.all(
          assignees
            .filter((a) => a.id !== owner.id)
            .map((assignee) =>
              postMessageInReviewThreadOrNewMessage(
                isBotUser ? "pr-comment-bots" : "pr-comment",
                assignee,
                assignedToSlackMessage,
                threadMessage,
              ),
            ),
        ).then((results) =>
          saveInDb(
            type,
            comment.id,
            repoContext.accountEmbed,
            results,
            isReviewComment ? threadMessage : assignedToSlackMessage,
          ),
        ),
        Promise.all([
          ...followers.map((follower) =>
            postMessageInReviewThreadOrNewMessage(
              isBotUser ? "pr-comment-follow-bots" : "pr-comment-follow",
              follower,
              notOwnerSlackMessage,
              threadMessage,
            ),
          ),
          ...usersInThread.map((user) =>
            postMessageInReviewThreadOrNewMessage(
              "pr-comment-thread",
              user,
              notOwnerSlackMessage,
              threadMessage,
            ),
          ),
          ...mentioned.map((u) =>
            postMessageInReviewThreadOrNewMessage(
              "pr-comment-mention",
              { id: u._id, login: u.login, type: u.type },
              notOwnerSlackMessage,
              threadMessage,
            ),
          ),
        ]).then((results) =>
          saveInDb(
            type,
            comment.id,
            repoContext.accountEmbed,
            results,
            isReviewComment ? threadMessage : notOwnerSlackMessage,
          ),
        ),
      ]);
    },
    async () => {
      // make sure review submitted is processed before this, as github could send both at the same time
      await delay(100);
      return {};
    },
  );
}
