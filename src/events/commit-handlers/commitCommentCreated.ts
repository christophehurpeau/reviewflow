import type { Probot } from "probot";
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
import { checkIfUserIsBot } from "../../utils/github/isBotUser";
import { parseMentions } from "../../utils/github/parseMentions";
import { createSlackMessageWithSecondaryBlock } from "../../utils/slack/createSlackMessageWithSecondaryBlock";
import { slackifyCommentBody } from "../../utils/slackifyCommentBody";
import type { BasicUser } from "../pr-handlers/utils/PullRequestData";
import { createCommitHandler } from "./utils/createCommitHandler";
import { fetchCommitComments } from "./utils/fetchCommitComments";

export default function commitCommentCreated(
  app: Probot,
  appContext: AppContext,
): void {
  const saveInDb = async (
    commentId: number,
    accountEmbed: AccountEmbed,
    results: PostSlackMessageResult[],
    message: SlackMessage,
  ): Promise<void> => {
    const filtered = results.filter(ExcludesNullish);
    if (filtered.length === 0) return;

    await appContext.mongoStores.slackSentMessages.insertOne({
      type: "commit-comment",
      typeId: commentId,
      message,
      account: accountEmbed,
      sentTo: filtered,
    });
  };

  createCommitHandler(
    app,
    appContext,
    ["commit_comment.created"],
    async (commit, context, repoContext): Promise<void> => {
      const { comment } = context.payload;
      const body = comment.body;
      if (!body) return;

      const mentionsInBody = parseMentions(body);

      const mentioned = await (mentionsInBody.length > 0
        ? appContext.mongoStores.users.findAll({
            login: { $in: mentionsInBody },
          })
        : []);
      const comments = await fetchCommitComments(context, commit.sha);

      const otherCommenters: NonNullable<(typeof comments)[number]["user"]>[] =
        [];
      comments.forEach((otherComment) => {
        if (comment.id === otherComment.id) return;
        const otherCommentUser = otherComment.user;
        if (!otherCommentUser) return;
        if (
          otherCommentUser.id !== comment.user.id &&
          !otherCommenters.some(
            (otherCommenter) => otherCommenter.id === otherCommentUser.id,
          )
        ) {
          otherCommenters.push(otherCommentUser);
        }
      });

      const mention = repoContext.slack.mention(comment.user.login);
      const commitUrl = slackUtils.createCommitLink(commit, repoContext);
      const author = commit.author || commit.committer;
      const commitAuthorMention =
        author && repoContext.slack.mention(author.login);

      const commentLink = slackUtils.createLink(comment.html_url, "commented");
      // const commentLinkPathText =
      //   comment.path && slackUtils.createLink(comment.html_url, comment.path);

      const createMessage = (toOwner?: boolean): string => {
        const ownerPart = toOwner
          ? "your commit"
          : `${commitAuthorMention}'s commit`;
        return `:speech_balloon: ${mention} ${commentLink} on ${ownerPart} ${commitUrl}`;
      };

      const slackifiedBodyBlocks = await slackifyCommentBody(
        repoContext,
        comment.body,
        (comment as any).start_line !== null,
      );

      const authorSlackMessage = createSlackMessageWithSecondaryBlock(
        createMessage(true),
        slackifiedBodyBlocks,
      );
      const notAuthorSlackMessage = createSlackMessageWithSecondaryBlock(
        createMessage(false),
        slackifiedBodyBlocks,
      );

      const isBotUser = checkIfUserIsBot(repoContext, comment.user);

      const postMessage = async (
        category: MessageCategory,
        toUser: AccountInfo,
        message: SlackMessage,
      ): Promise<SlackMessageResult | null> => {
        return repoContext.slack.postMessage(category, toUser, message);
      };

      await Promise.all([
        author &&
          author.id !== comment.user.id &&
          postMessage(
            isBotUser ? "commit-comment-bots" : "commit-comment",
            author as BasicUser,
            authorSlackMessage,
          ).then(
            (result) =>
              result &&
              saveInDb(
                comment.id,
                repoContext.accountEmbed,
                [result],
                authorSlackMessage,
              ),
          ),
        Promise.all([
          ...otherCommenters.map((otherCommenter) =>
            postMessage(
              isBotUser
                ? "commit-comment-follow-bots"
                : "commit-comment-follow",
              otherCommenter,
              notAuthorSlackMessage,
            ),
          ),
          ...mentioned.map((u) =>
            postMessage(
              "commit-comment-mention",
              { id: u._id, login: u.login, type: u.type },
              notAuthorSlackMessage,
            ),
          ),
        ]).then((results) =>
          saveInDb(
            comment.id,
            repoContext.accountEmbed,
            results,
            notAuthorSlackMessage,
          ),
        ),
      ]);
    },
  );
}
