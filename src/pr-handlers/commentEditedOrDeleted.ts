import { Application } from 'probot';
import { WebhookPayloadPullRequestReviewComment } from '@octokit/webhooks';
import { AppContext } from '../context/AppContext';
import { createHandlerPullRequestChange } from './utils';
import { createTextSecondaryBlock } from './utils/createSlackMessageWithSecondaryBlock';

export default function prCommentEditedOrDeleted(
  app: Application,
  appContext: AppContext,
): void {
  app.on(
    [
      'pull_request_review_comment.edited',
      'pull_request_review_comment.deleted',
      // comments without review and without path are sent with issue_comment.created.
      // createHandlerPullRequestChange checks if pull_request event is present, removing real issues comments.
      'issue_comment.edited',
      'issue_comment.deleted',
    ],
    createHandlerPullRequestChange<WebhookPayloadPullRequestReviewComment>(
      appContext,
      { refetchPr: false },
      async (pr, context, repoContext): Promise<void> => {
        const { comment } = context.payload;
        const type = comment.pull_request_review_id
          ? 'review-comment'
          : 'issue-comment';

        const criteria = {
          'account.id': repoContext.account._id,
          'account.type': repoContext.accountType,
          type,
          typeId: comment.id,
        };

        const sentMessages = await appContext.mongoStores.slackSentMessages.findAll(
          criteria,
        );

        if (sentMessages.length === 0) return;

        if (context.payload.action === 'deleted') {
          await Promise.all([
            Promise.all(
              sentMessages.map((sentMessage) =>
                Promise.all(
                  sentMessage.sentTo.map((sentTo) =>
                    repoContext.slack.deleteMessage(sentTo.ts, sentTo.channel),
                  ),
                ),
              ),
            ),
            appContext.mongoStores.slackSentMessages.deleteMany(criteria),
          ]);
        } else {
          const secondaryBlocks = [createTextSecondaryBlock(comment.body)];

          await Promise.all([
            Promise.all(
              sentMessages.map((sentMessage) =>
                Promise.all(
                  sentMessage.sentTo.map((sentTo) =>
                    repoContext.slack.updateMessage(sentTo.ts, sentTo.channel, {
                      ...sentMessage.message,
                      secondaryBlocks,
                    }),
                  ),
                ),
              ),
            ),
            appContext.mongoStores.slackSentMessages.partialUpdateMany(
              criteria,
              { $set: { 'message.secondaryBlocks': secondaryBlocks } },
            ),
          ]);
        }
      },
    ),
  );
}
