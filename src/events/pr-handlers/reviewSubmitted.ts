import { Application } from 'probot';
import slackifyMarkdown from 'slackify-markdown';
import { AppContext } from '../../context/AppContext';
import * as slackUtils from '../../slack/utils';
import { createHandlerPullRequestChange } from './utils';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { getReviewersAndReviewStates } from './utils/getReviewersAndReviewStates';
import { createSlackMessageWithSecondaryBlock } from './utils/createSlackMessageWithSecondaryBlock';

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
  app: Application,
  appContext: AppContext,
): void {
  app.on(
    'pull_request_review.submitted',
    createHandlerPullRequestChange(
      appContext,
      { refetchPr: true },
      async (pr, context, repoContext): Promise<void> => {
        const {
          user: reviewer,
          state,
          body,
          html_url: reviewUrl,
        } = (context.payload as any).review;

        const reviewByOwner = pr.user.login === reviewer.login;
        const { reviewers, reviewStates } = await getReviewersAndReviewStates(
          context,
          repoContext,
        );
        const followers = reviewers.filter(
          (user) => user.id !== reviewer.id && user.id !== pr.user.id,
        );

        if (pr.requested_reviewers) {
          followers.push(
            ...pr.requested_reviewers.filter((rr) => {
              return (
                !followers.find((f) => f.id === rr.id) &&
                rr.id !== reviewer.id &&
                rr.id !== pr.user.id
              );
            }),
          );
        }

        if (!reviewByOwner) {
          const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);
          let merged: boolean;

          if (
            reviewerGroup &&
            repoContext.config.labels.review[reviewerGroup]
          ) {
            const hasRequestedReviewsForGroup = repoContext.approveShouldWait(
              reviewerGroup,
              pr.requested_reviewers,
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

            const newLabels = await updateReviewStatus(
              pr,
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
                appContext,
                pr,
                context,
                repoContext,
                newLabels,
              );
            }
          }

          repoContext.slack.updateHome(pr.user.login);
          repoContext.slack.updateHome(reviewer.login);

          const sentMessageRequestedReview = await appContext.mongoStores.slackSentMessages.findOne(
            {
              'account.id': repoContext.account._id,
              'account.type': repoContext.accountType,
              type: 'review-requested',
              typeId: `${pr.id}_${reviewer.id}`,
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
          const prUrl = slackUtils.createPrLink(pr, repoContext);
          const ownerMention = repoContext.slack.mention(pr.user.login);

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

          const slackifiedBody = slackifyMarkdown(body);

          repoContext.slack.postMessage(
            'pr-review',
            pr.user.id,
            pr.user.login,
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
          const prUrl = slackUtils.createPrLink(pr, repoContext);
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
