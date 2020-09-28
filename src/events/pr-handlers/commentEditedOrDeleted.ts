import { Application } from 'probot';
import { WebhookPayloadPullRequestReviewComment } from '@octokit/webhooks';
import { AppContext } from '../../context/AppContext';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { createMrkdwnSectionBlock } from './utils/createSlackMessageWithSecondaryBlock';
import {
  getPullRequestFromPayload,
  PullRequestFromPayload,
} from './utils/getPullRequestFromPayload';
import { checkIfIsThisBot } from './utils/isBotUser';
import { syncLabelsAfterCommentBodyEdited } from './actions/syncLabelsAfterCommentBodyEdited';
import { fetchPullRequestAndCreateContext } from './utils/createPullRequestContext';
import { slackifyCommentBody } from './utils/slackifyCommentBody';

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
    createPullRequestHandler<
      WebhookPayloadPullRequestReviewComment,
      PullRequestFromPayload<WebhookPayloadPullRequestReviewComment>
    >(
      appContext,
      (payload) => {
        if (checkIfIsThisBot(payload.sender)) {
          // ignore edits made from this bot
          return null;
        }
        return getPullRequestFromPayload(payload);
      },
      async (prContext, context, repoContext): Promise<void> => {
        const { comment } = context.payload;

        if (
          context.payload.action === 'edited' &&
          checkIfIsThisBot(comment.user)
        ) {
          const updatedPrContext = await fetchPullRequestAndCreateContext(
            context,
            prContext,
          );
          if (!updatedPrContext.updatedPr.closed_at) {
            await syncLabelsAfterCommentBodyEdited(
              appContext,
              repoContext,
              updatedPrContext.updatedPr,
              context,
              updatedPrContext,
            );
          }
          return;
        }

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
          const secondaryBlocks = [
            createMrkdwnSectionBlock(
              slackifyCommentBody(
                comment.body,
                (comment as any).start_line !== null,
              ),
            ),
          ];

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
