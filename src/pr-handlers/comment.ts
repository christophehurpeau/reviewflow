import { Application, Octokit, Context } from 'probot';
import { WebhookPayloadPullRequestReviewComment } from '@octokit/webhooks';
import { contextPr } from '../context/utils';
import { MongoStores } from '../mongo';
import { createHandlerPullRequestChange } from './utils';
import { postSlackMessageWithSecondaryBlock } from './utils/postSlackMessageWithSecondaryBlock';
import { listReviews } from './utils/listReviews';
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

export default function prComment(
  app: Application,
  mongoStores: MongoStores,
): void {
  app.on(
    'pull_request_review_comment.created',
    createHandlerPullRequestChange<WebhookPayloadPullRequestReviewComment>(
      mongoStores,
      async (pr, context, repoContext): Promise<void> => {
        const { comment } = context.payload;

        const body = comment.body;
        if (!body) return;

        const commentByOwner = pr.user.login === comment.user.login;
        const [discussion, reviews] = await Promise.all([
          getDiscussion(context, comment),
          listReviews(context),
        ]);

        const reviewers = reviews.map((review) => review.user);
        const followers = commentByOwner
          ? reviewers
          : reviewers.filter((user) => user.login !== comment.user.login);

        const usersInThread = getUsersInThread(discussion).filter(
          (u) => u.id !== pr.user.id && !followers.find((f) => f.id === u.id),
        );
        const mentions = getMentions(discussion).filter(
          (m) =>
            m !== pr.user.login &&
            !followers.find((f) => f.login === m) &&
            !usersInThread.find((u) => u.login === m),
        );

        const mention = repoContext.slack.mention(comment.user.login);
        const prUrl = repoContext.slack.prLink(pr, context);
        const ownerMention = repoContext.slack.mention(pr.user.login);
        const commentLink = repoContext.slack.link(
          comment.html_url,
          'commented',
        );

        const createMessage = (toOwner?: boolean): string => {
          const ownerPart = toOwner ? 'your PR' : `${ownerMention}'s PR `;
          return `:speech_balloon: ${mention} ${commentLink} on ${ownerPart} ${prUrl}`;
        };

        if (!commentByOwner) {
          postSlackMessageWithSecondaryBlock(
            repoContext,
            'pr-comment',
            pr.user.id,
            pr.user.login,
            createMessage(true),
            body,
          );
        }

        followers.forEach((follower) => {
          postSlackMessageWithSecondaryBlock(
            repoContext,
            'pr-comment-follow',
            follower.id,
            follower.login,
            createMessage(false),
            body,
          );
        });

        usersInThread.forEach((user) => {
          postSlackMessageWithSecondaryBlock(
            repoContext,
            'pr-comment-thread',
            user.id,
            user.login,
            createMessage(false),
            body,
          );
        });

        mongoStores.users
          .findAll({ login: { $in: mentions } })
          .then((users) => {
            users.forEach((u) => {
              postSlackMessageWithSecondaryBlock(
                repoContext,
                'pr-comment-mention',
                u._id as any, // TODO _id is number
                u.login,
                createMessage(false),
                body,
              );
            });
          });
      },
    ),
  );
}
