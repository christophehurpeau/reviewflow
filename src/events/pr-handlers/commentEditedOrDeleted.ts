import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import { checkIfIsThisBot } from '../../utils/github/isBotUser';
import { slackifyCommentBody } from '../../utils/slackifyCommentBody';
import { commentBodyEdited } from './actions/commentBodyEdited';
import {
  deleteSlackSentMessages,
  findSlackSentMessages,
  updateSlackSentMessages,
} from './actions/utils/slackUtils';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { fetchPr } from './utils/fetchPr';
import { getPullRequestFromPayload } from './utils/getPullRequestFromPayload';

export default function prCommentEditedOrDeleted<TeamNames extends string>(
  app: Probot,
  appContext: AppContext,
): void {
  createPullRequestHandler<
    TeamNames,
    | 'issue_comment.deleted'
    | 'issue_comment.edited'
    | 'pull_request_review_comment.deleted'
    | 'pull_request_review_comment.edited'
    | 'pull_request_review.edited'
  >(
    app,
    appContext,
    [
      'pull_request_review.edited',
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
      // Comment updated is reviewflow comment body
      if (
        context.name === 'issue_comment' &&
        context.payload.action === 'edited' &&
        context.payload.comment &&
        reviewflowPrContext !== null &&
        context.payload.action === 'edited' &&
        checkIfIsThisBot(context.payload.comment.user)
      ) {
        const updatedPr = await fetchPr(context, pullRequest.number);
        if (!updatedPr.closed_at) {
          await commentBodyEdited(
            updatedPr,
            context,
            appContext,
            repoContext,
            reviewflowPrContext,
          );
        }
        return;
      }

      const getTypeAndComment = () => {
        if ('review' in context.payload) {
          return ['review-submitted', context.payload.review] as const;
        }

        const comment = context.payload.comment;

        return [
          'pull_request_review_id' in comment
            ? 'review-comment'
            : 'issue-comment',
          comment,
        ] as const;
      };

      const [type, comment] = getTypeAndComment();
      const typeId = comment.id;

      if (context.payload.action === 'deleted') {
        await deleteSlackSentMessages(appContext, repoContext, {
          type,
          typeId,
        });
        return;
      }

      const sentMessages = await findSlackSentMessages(
        appContext,
        repoContext,
        {
          type,
          typeId,
        },
      );

      if (sentMessages.length === 0) return;

      const secondaryBlocks = await slackifyCommentBody(
        repoContext,
        comment.body || '',
        (comment as any).start_line !== null,
      );

      await updateSlackSentMessages(appContext, repoContext, {
        type,
        typeId,
        partialMessage: {
          secondaryBlocks,
        },
      });
    },
  );
}
