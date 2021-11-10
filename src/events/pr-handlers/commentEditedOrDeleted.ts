import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import { syncLabelsAfterCommentBodyEdited } from './actions/syncLabelsAfterCommentBodyEdited';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { createMrkdwnSectionBlock } from './utils/createSlackMessageWithSecondaryBlock';
import { fetchPr } from './utils/fetchPr';
import { getPullRequestFromPayload } from './utils/getPullRequestFromPayload';
import { checkIfIsThisBot } from './utils/isBotUser';
import { slackifyCommentBody } from './utils/slackifyCommentBody';

export default function prCommentEditedOrDeleted(
  app: Probot,
  appContext: AppContext,
): void {
  createPullRequestHandler<
    | 'pull_request_review_comment.edited'
    | 'pull_request_review_comment.deleted'
    | 'issue_comment.edited'
    | 'issue_comment.deleted'
  >(
    app,
    appContext,
    [
      'pull_request_review_comment.edited',
      'pull_request_review_comment.deleted',
      // comments without review and without path are sent with issue_comment.created.
      // createHandlerPullRequestChange checks if pull_request event is present, removing real issues comments.
      'issue_comment.edited',
      'issue_comment.deleted',
    ],
    (payload) => {
      if (checkIfIsThisBot(payload.sender)) {
        // ignore edits made from this bot
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
      const { comment } = context.payload;

      if (
        reviewflowPrContext !== null &&
        context.payload.action === 'edited' &&
        checkIfIsThisBot(comment.user)
      ) {
        const updatedPr = await fetchPr(context, pullRequest.number);
        if (!updatedPr.closed_at) {
          await syncLabelsAfterCommentBodyEdited(
            updatedPr,
            context,
            repoContext,
            reviewflowPrContext,
          );
        }
        return;
      }

      const type =
        'pull_request_review_id' in comment
          ? 'review-comment'
          : 'issue-comment';

      const criteria = {
        'account.id': repoContext.accountEmbed.id,
        'account.type': repoContext.accountEmbed.type,
        type,
        typeId: comment.id,
      };

      const sentMessages =
        await appContext.mongoStores.slackSentMessages.findAll(criteria);

      if (sentMessages.length === 0) return;

      if (context.payload.action === 'deleted') {
        await Promise.all([
          Promise.all(
            sentMessages.map((sentMessage) =>
              Promise.all(
                sentMessage.sentTo.map(
                  (sentTo) =>
                    sentTo.user && // legacy
                    repoContext.slack.deleteMessage(
                      sentTo.user,
                      sentTo.ts,
                      sentTo.channel,
                    ),
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
                sentMessage.sentTo.map(
                  (sentTo) =>
                    sentTo.user && // legacy
                    repoContext.slack.updateMessage(
                      sentTo.user,
                      sentTo.ts,
                      sentTo.channel,
                      {
                        ...sentMessage.message,
                        secondaryBlocks,
                      },
                    ),
                ),
              ),
            ),
          ),
          appContext.mongoStores.slackSentMessages.partialUpdateMany(criteria, {
            $set: { 'message.secondaryBlocks': secondaryBlocks },
          }),
        ]);
      }
    },
  );
}
