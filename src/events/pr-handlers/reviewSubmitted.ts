import type { Probot } from 'probot';
import slackifyMarkdown from 'slackify-markdown';
import type { AppContext } from '../../context/AppContext';
import * as slackUtils from '../../slack/utils';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { createSlackMessageWithSecondaryBlock } from './utils/createSlackMessageWithSecondaryBlock';
import { fetchPr } from './utils/fetchPr';
import { getReviewersAndReviewStates } from './utils/getReviewersAndReviewStates';

const getEmojiFromState = (state: string): string => {
  switch (state) {
    case 'changes_requested':
      return 'x';
    case 'approved':
      return 'white_check_mark';
    default:
      return 'speech_balloon';
  }
};

export default function reviewSubmitted(
  app: Probot,
  appContext: AppContext,
): void {
  app.on(
    'pull_request_review.submitted',
    createPullRequestHandler(
      appContext,
      (payload) => payload.pull_request,
      async (
        pullRequest,
        context,
        repoContext,
        reviewflowPrContext,
      ): Promise<void> => {
        const { payload } = context;

        const {
          user: reviewer,
          state,
          body,
          html_url: reviewUrl,
        } = payload.review;

        const reviewByOwner = pullRequest.user.login === reviewer.login;
        const { reviewers, reviewStates } = await getReviewersAndReviewStates(
          context,
          repoContext,
        );
        const followers = reviewers.filter(
          (user) => user.id !== reviewer.id && user.id !== pullRequest.user.id,
        );

        if (pullRequest.requested_reviewers) {
          followers.push(
            ...pullRequest.requested_reviewers.filter((rr) => {
              return (
                !followers.find((f) => f.id === rr.id) &&
                rr.id !== reviewer.id &&
                rr.id !== pullRequest.user.id
              );
            }),
          );
        }

        if (!reviewByOwner) {
          const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);
          let merged: boolean;

          if (
            reviewflowPrContext &&
            !repoContext.shouldIgnore &&
            reviewerGroup &&
            repoContext.config.labels.review[reviewerGroup]
          ) {
            const hasRequestedReviewsForGroup = repoContext.approveShouldWait(
              reviewerGroup,
              pullRequest.requested_reviewers,
              {
                includesReviewerGroup: true,
                // TODO reenable this when accepted can notify request review to slack (dev accepted => design requested) and flag to disable for label (approved design ; still waiting for dev ?)
                // includesWaitForGroups: true,
              },
            );

            const hasChangesRequestedInReviews =
              reviewStates[reviewerGroup].changesRequested !== 0;

            const approved =
              !hasRequestedReviewsForGroup &&
              !hasChangesRequestedInReviews &&
              state === 'approved';

            const updatedPr = await fetchPr(context, pullRequest.number);

            const newLabels = await updateReviewStatus(
              updatedPr,
              context,
              repoContext,
              reviewerGroup,
              {
                add: [
                  approved && 'approved',
                  state === 'changes_requested' && 'needsReview',
                  state === 'changes_requested' && 'changesRequested',
                ],
                remove: [
                  approved && 'needsReview',
                  !hasRequestedReviewsForGroup && 'requested',
                  state === 'approved' &&
                    !hasChangesRequestedInReviews &&
                    'changesRequested',
                  state === 'changes_requested' && 'approved',
                ],
              },
            );

            if (approved && !hasChangesRequestedInReviews) {
              merged = await autoMergeIfPossible(
                updatedPr,
                context,
                repoContext,
                reviewflowPrContext,
                newLabels,
              );
            }
          }

          if (pullRequest.assignees) {
            pullRequest.assignees.forEach((assignee) => {
              repoContext.slack.updateHome(assignee.login);
            });
          }
          if (
            !pullRequest.assignees.find(
              (assignee) => assignee.login === reviewer.login,
            )
          ) {
            repoContext.slack.updateHome(reviewer.login);
          }

          const sentMessageRequestedReview = await appContext.mongoStores.slackSentMessages.findOne(
            {
              'account.id': repoContext.account._id,
              'account.type': repoContext.accountType,
              type: 'review-requested',
              typeId: `${pullRequest.id}_${reviewer.id}`,
            },
          );

          const emoji = getEmojiFromState(state);

          if (sentMessageRequestedReview) {
            const sentTo = sentMessageRequestedReview.sentTo[0];
            const message = sentMessageRequestedReview.message;
            await Promise.all([
              repoContext.slack.updateMessage(sentTo.ts, sentTo.channel, {
                ...message,
                text: message.text
                  .split('\n')
                  .map((l) => `~${l}~`)
                  .join('\n'),
              }),
              repoContext.slack.addReaction(sentTo.ts, sentTo.channel, emoji),
              appContext.mongoStores.slackSentMessages.deleteOne(
                sentMessageRequestedReview,
              ),
            ]);
          }

          if (!body && state !== 'changes_requested' && state !== 'approved') {
            return;
          }

          const mention = repoContext.slack.mention(reviewer.login);
          const prUrl = slackUtils.createPrLink(pullRequest, repoContext);
          const ownerMention = repoContext.slack.mention(
            pullRequest.user.login,
          );

          const createMessage = (toOwner?: boolean): string => {
            const ownerPart = toOwner ? 'your PR' : `${ownerMention}'s PR`;

            if (state === 'changes_requested') {
              return `:${emoji}: ${mention} requests changes on ${ownerPart} ${prUrl}`;
            }
            if (state === 'approved') {
              return `${
                toOwner ? ':clap: ' : ''
              }:${emoji}: ${mention} approves ${ownerPart} ${prUrl}${
                merged ? ' and PR is merged :tada:' : ''
              }`;
            }

            const commentLink = slackUtils.createLink(reviewUrl, 'commented');
            return `:${emoji}: ${mention} ${commentLink} on ${ownerPart} ${prUrl}`;
          };

          const slackifiedBody = slackifyMarkdown((body as unknown) as string);

          repoContext.slack.postMessage(
            'pr-review',
            pullRequest.user.id,
            pullRequest.user.login,
            createSlackMessageWithSecondaryBlock(
              createMessage(true),
              slackifiedBody,
            ),
          );

          const message = createSlackMessageWithSecondaryBlock(
            createMessage(false),
            slackifiedBody,
          );

          followers.forEach((follower) => {
            repoContext.slack.postMessage(
              'pr-review-follow',
              follower.id,
              follower.login,
              message,
            );
          });
        } else if (body) {
          const mention = repoContext.slack.mention(reviewer.login);
          const prUrl = slackUtils.createPrLink(pullRequest, repoContext);
          const commentLink = slackUtils.createLink(reviewUrl, 'commented');

          const message = createSlackMessageWithSecondaryBlock(
            `:speech_balloon: ${mention} ${commentLink} on his PR ${prUrl}`,
            body,
          );

          followers.forEach((follower) => {
            repoContext.slack.postMessage(
              'pr-review-follow',
              follower.id,
              follower.login,
              message,
            );
          });
        }
      },
    ),
  );
}
