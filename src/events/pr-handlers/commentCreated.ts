import type { RestEndpointMethodTypes } from '@octokit/rest';
import type { Probot, Context } from 'probot';
import type { AccountInfo } from 'context/getOrCreateAccount';
import type { AppContext } from '../../context/AppContext';
import type { SlackMessage } from '../../context/slack/SlackMessage';
import type { PostSlackMessageResult } from '../../context/slack/TeamSlack';
import type { AccountEmbed } from '../../mongo';
import * as slackUtils from '../../slack/utils';
import { ExcludesFalsy, ExcludesNullish } from '../../utils/Excludes';
import type { ProbotEvent } from '../probot-types';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { createSlackMessageWithSecondaryBlock } from './utils/createSlackMessageWithSecondaryBlock';
import { fetchPr } from './utils/fetchPr';
import { getPullRequestFromPayload } from './utils/getPullRequestFromPayload';
import { getReviewersAndReviewStates } from './utils/getReviewersAndReviewStates';
import { checkIfUserIsBot, checkIfIsThisBot } from './utils/isBotUser';
import { parseMentions } from './utils/parseMentions';
import { slackifyCommentBody } from './utils/slackifyCommentBody';

type Comment = ProbotEvent<
  'pull_request_review_comment.created' | 'issue_comment.created'
>['payload']['comment'];

const getDiscussion = async (
  context: Context,
  comment: Comment,
): Promise<
  | RestEndpointMethodTypes['pulls']['listReviewComments']['response']['data']
  | Comment[]
> => {
  if (!('in_reply_to_id' in comment) || !comment.in_reply_to_id) {
    return [comment];
  }
  return context.octokit.paginate(
    context.octokit.pulls.listReviewComments,
    context.pullRequest({
      sort: 'created',
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
    | RestEndpointMethodTypes['pulls']['listReviewComments']['response']['data']
    | Comment[],
): string[] => {
  const mentions = new Set<string>();

  discussion.forEach((c) => {
    parseMentions(c.body).forEach((m) => mentions.add(m));
  });

  return [...mentions];
};

const getUsersInThread = (
  discussion:
    | RestEndpointMethodTypes['pulls']['listReviewComments']['response']['data']
    | Comment[],
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
    type: 'review-comment' | 'issue-comment',
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
      'pull_request_review_comment.created',
      // comments without review and without path are sent with issue_comment.created.
      // createHandlerPullRequestChange checks if pull_request event is present, removing real issues comments.
      'issue_comment.created',
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
      const type = (comment as any).pull_request_review_id
        ? 'review-comment'
        : 'issue-comment';

      const body = comment.body;
      if (!body) return;

      const commentByOwner = prUser.login === comment.user.login;
      const [discussion, { reviewers }] = await Promise.all([
        getDiscussion(context, comment),
        getReviewersAndReviewStates(context, repoContext),
      ]);

      const followers: AccountInfo[] = reviewers.filter(
        (u) => u.id !== prUser.id && u.id !== comment.user.id,
      );

      if (pr.requested_reviewers) {
        followers.push(
          ...pr.requested_reviewers
            .filter((rr) => {
              return (
                rr &&
                !followers.some((f) => f.id === rr.id) &&
                rr.id !== (comment.user && comment.user.id) &&
                rr.id !== prUser.id
              );
            })
            .filter(ExcludesFalsy)
            .map<AccountInfo>((rr) => ({
              id: rr.id,
              login: rr.login,
              type: rr.type,
            })),
        );
      }

      const usersInThread = getUsersInThread(discussion).filter(
        (u) =>
          u.id !== prUser.id &&
          u.id !== comment.user.id &&
          !followers.some((f) => f.id === u.id),
      );
      const mentions = getMentions(discussion).filter(
        (m) =>
          m !== prUser.login &&
          m !== comment.user.login &&
          !followers.some((f) => f.login === m) &&
          !usersInThread.some((u) => u.login === m),
      );

      const mention = repoContext.slack.mention(comment.user.login);
      const prUrl = slackUtils.createPrLink(pr, repoContext);
      const ownerMention = repoContext.slack.mention(prUser.login);
      const commentLink = slackUtils.createLink(
        comment.html_url,
        (comment as any).in_reply_to_id ? 'replied' : 'commented',
      );

      const createMessage = (toOwner?: boolean): string => {
        const ownerPart = toOwner
          ? 'your PR'
          : `${
              (prUser && prUser.id) === comment.user.id
                ? 'his'
                : `${ownerMention}'s`
            } PR`;
        return `:speech_balloon: ${mention} ${commentLink} on ${ownerPart} ${prUrl}`;
      };

      const promisesOwner: Promise<PostSlackMessageResult>[] = [];
      const promisesNotOwner: Promise<PostSlackMessageResult>[] = [];

      const slackifiedBody = slackifyCommentBody(
        comment.body,
        (comment as any).start_line !== null,
      );

      const ownerSlackMessage = createSlackMessageWithSecondaryBlock(
        createMessage(true),
        slackifiedBody,
      );
      const notOwnerSlackMessage = createSlackMessageWithSecondaryBlock(
        createMessage(false),
        slackifiedBody,
      );

      const isBotUser = checkIfUserIsBot(repoContext, comment.user);

      if (!commentByOwner) {
        promisesOwner.push(
          repoContext.slack.postMessage(
            isBotUser ? 'pr-comment-bots' : 'pr-comment',
            prUser,
            ownerSlackMessage,
          ),
        );
      }

      promisesNotOwner.push(
        ...followers.map((follower) =>
          repoContext.slack.postMessage(
            isBotUser ? 'pr-comment-follow-bots' : 'pr-comment-follow',
            follower,
            notOwnerSlackMessage,
          ),
        ),
        ...usersInThread.map((user) =>
          repoContext.slack.postMessage(
            'pr-comment-thread',
            user,
            notOwnerSlackMessage,
          ),
        ),
      );

      if (mentions.length > 0) {
        await appContext.mongoStores.users
          .findAll({ login: { $in: mentions } })
          .then((users) => {
            promisesNotOwner.push(
              ...users.map((u) =>
                repoContext.slack.postMessage(
                  'pr-comment-mention',
                  { id: u._id, login: u.login, type: u.type },
                  notOwnerSlackMessage,
                ),
              ),
            );
          });
      }

      await Promise.all([
        Promise.all(promisesOwner).then((results) =>
          saveInDb(
            type,
            comment.id,
            repoContext.accountEmbed,
            results,
            ownerSlackMessage,
          ),
        ),
        Promise.all(promisesNotOwner).then((results) =>
          saveInDb(
            type,
            comment.id,
            repoContext.accountEmbed,
            results,
            notOwnerSlackMessage,
          ),
        ),
      ]);
    },
  );
}
