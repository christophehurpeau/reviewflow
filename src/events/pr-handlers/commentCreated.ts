import { Application, Octokit, Context } from 'probot';
import { WebhookPayloadPullRequestReviewComment } from '@octokit/webhooks';
import slackifyMarkdown from 'slackify-markdown';
import * as slackUtils from '../../slack/utils';
import { AccountEmbed } from '../../mongo';
import { SlackMessage } from '../../context/SlackMessage';
import { PostSlackMessageResult } from '../../context/TeamSlack';
import { contextPr } from '../../context/utils';
import { AppContext } from '../../context/AppContext';
import { createHandlerPullRequestChange } from './utils';
import { createSlackMessageWithSecondaryBlock } from './utils/createSlackMessageWithSecondaryBlock';
import { getReviewersAndReviewStates } from './utils/getReviewersAndReviewStates';
import { parseMentions } from './utils/parseMentions';

const getDiscussion = async (
  context: Context,
  comment: any,
): Promise<Octokit.PullsListCommentsResponse> => {
  if (!comment.in_reply_to_id) return [comment];
  return context.github.paginate(
    context.github.pulls.listComments.endpoint.merge(contextPr(context)),
    ({ data }: Octokit.Response<Octokit.PullsListCommentsResponse>) => {
      return data.filter(
        (c) =>
          c.in_reply_to_id === comment.in_reply_to_id ||
          c.id === comment.in_reply_to_id,
      );
    },
  );
};

const getMentions = (
  discussion: Octokit.PullsListCommentsResponse,
): string[] => {
  const mentions = new Set<string>();

  discussion.forEach((c) => {
    parseMentions(c.body).forEach((m) => mentions.add(m));
  });

  return [...mentions];
};

const getUsersInThread = (
  discussion: Octokit.PullsListCommentsResponse,
): { id: number; login: string }[] => {
  const userIds = new Set<number>();
  const users: { id: number; login: string }[] = [];

  discussion.forEach((c) => {
    if (userIds.has(c.user.id)) return;
    userIds.add(c.user.id);
    users.push({ id: c.user.id, login: c.user.login });
  });

  return users;
};

export default function prCommentCreated(
  app: Application,
  appContext: AppContext,
): void {
  const saveInDb = async (
    type: 'review-comment' | 'issue-comment',
    commentId: number,
    accountEmbed: AccountEmbed,
    results: PostSlackMessageResult[],
    message: SlackMessage,
  ): Promise<void> => {
    const filtered = results.filter((res) => res !== null);
    if (filtered.length === 0) return;

    await appContext.mongoStores.slackSentMessages.insertOne({
      type,
      typeId: commentId,
      message,
      account: accountEmbed,
      sentTo: filtered,
    });
  };

  app.on(
    [
      'pull_request_review_comment.created',
      // comments without review and without path are sent with issue_comment.created.
      // createHandlerPullRequestChange checks if pull_request event is present, removing real issues comments.
      'issue_comment.created',
    ],
    createHandlerPullRequestChange<WebhookPayloadPullRequestReviewComment>(
      appContext,
      { refetchPr: true },
      async (pr, context, repoContext): Promise<void> => {
        const { comment } = context.payload;
        const type = comment.pull_request_review_id
          ? 'review-comment'
          : 'issue-comment';

        const body = comment.body;
        if (!body) return;

        const commentByOwner = pr.user.login === comment.user.login;
        const [discussion, { reviewers }] = await Promise.all([
          getDiscussion(context, comment),
          getReviewersAndReviewStates(context, repoContext),
        ]);

        const followers = reviewers.filter(
          (u) => u.id !== pr.user.id && u.id !== comment.user.id,
        );

        if (pr.requested_reviewers) {
          followers.push(
            ...pr.requested_reviewers.filter((rr) => {
              return (
                !followers.find((f) => f.id === rr.id) &&
                rr.id !== comment.user.id &&
                rr.id !== pr.user.id
              );
            }),
          );
        }

        const usersInThread = getUsersInThread(discussion).filter(
          (u) =>
            u.id !== pr.user.id &&
            u.id !== comment.user.id &&
            !followers.find((f) => f.id === u.id),
        );
        const mentions = getMentions(discussion).filter(
          (m) =>
            m !== pr.user.login &&
            m !== comment.user.login &&
            !followers.find((f) => f.login === m) &&
            !usersInThread.find((u) => u.login === m),
        );

        const mention = repoContext.slack.mention(comment.user.login);
        const prUrl = slackUtils.createPrLink(pr, repoContext);
        const ownerMention = repoContext.slack.mention(pr.user.login);
        const commentLink = slackUtils.createLink(
          comment.html_url,
          (comment as any).in_reply_to_id ? 'replied' : 'commented',
        );

        const createMessage = (toOwner?: boolean): string => {
          const ownerPart = toOwner
            ? 'your PR'
            : `${
                pr.user.id === comment.user.id ? 'his' : `${ownerMention}'s`
              } PR`;
          return `:speech_balloon: ${mention} ${commentLink} on ${ownerPart} ${prUrl}`;
        };

        const promisesOwner = [];
        const promisesNotOwner = [];
        const slackifiedBody = slackifyMarkdown(body);

        if (!commentByOwner) {
          const slackMessage = createSlackMessageWithSecondaryBlock(
            createMessage(true),
            slackifiedBody,
          );

          promisesOwner.push(
            repoContext.slack
              .postMessage(
                'pr-comment',
                pr.user.id,
                pr.user.login,
                slackMessage,
              )
              .then((res) =>
                saveInDb(
                  type,
                  comment.id,
                  repoContext.accountEmbed,
                  [res],
                  slackMessage,
                ),
              ),
          );
        }

        const message = createSlackMessageWithSecondaryBlock(
          createMessage(false),
          slackifiedBody,
        );

        promisesNotOwner.push(
          ...followers.map((follower) =>
            repoContext.slack.postMessage(
              'pr-comment-follow',
              follower.id,
              follower.login,
              message,
            ),
          ),
        );

        promisesNotOwner.push(
          ...usersInThread.map((user) =>
            repoContext.slack.postMessage(
              'pr-comment-thread',
              user.id,
              user.login,
              message,
            ),
          ),
        );

        if (mentions.length !== 0) {
          await appContext.mongoStores.users
            .findAll({ login: { $in: mentions } })
            .then((users) => {
              promisesNotOwner.push(
                ...users.map((u) =>
                  repoContext.slack.postMessage(
                    'pr-comment-mention',
                    u._id as any, // TODO _id is number
                    u.login,
                    message,
                  ),
                ),
              );
            });
        }

        await Promise.all([
          Promise.all(promisesOwner),
          Promise.all(promisesNotOwner).then((results) =>
            saveInDb(
              type,
              comment.id,
              repoContext.accountEmbed,
              results,
              message,
            ),
          ),
        ]);
      },
    ),
  );
}
