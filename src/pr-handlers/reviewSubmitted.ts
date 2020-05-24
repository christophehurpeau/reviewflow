import { Application } from 'probot';
import { AppContext } from '../context/AppContext';
import { createHandlerPullRequestChange } from './utils';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { getReviewersAndReviewStates } from './utils/getReviewersAndReviewStates';
import { createSlackMessageWithSecondaryBlock } from './utils/createSlackMessageWithSecondaryBlock';

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
          (user, index) => user.id !== reviewer.id && user.id !== pr.user.id,
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
                pr,
                context,
                repoContext,
                newLabels,
              );
            }
          }

          repoContext.slack.updateHome(pr.user.login);
          repoContext.slack.updateHome(reviewer.login);

          const mention = repoContext.slack.mention(reviewer.login);
          const prUrl = repoContext.slack.prLink(pr, context);
          const ownerMention = repoContext.slack.mention(pr.user.login);

          if (!body && state !== 'changes_requested' && state !== 'approved') {
            return;
          }

          const createMessage = (toOwner?: boolean): string => {
            const ownerPart = toOwner ? 'your PR' : `${ownerMention}'s PR`;

            if (state === 'changes_requested') {
              return `:x: ${mention} requests changes on ${ownerPart} ${prUrl}`;
            }
            if (state === 'approved') {
              return `${
                toOwner ? ':clap: ' : ''
              }:white_check_mark: ${mention} approves ${ownerPart} ${prUrl}${
                merged ? ' and PR is merged :tada:' : ''
              }`;
            }

            const commentLink = repoContext.slack.link(reviewUrl, 'commented');
            return `:speech_balloon: ${mention} ${commentLink} on ${ownerPart} ${prUrl}`;
          };

          repoContext.slack.postMessage(
            'pr-review',
            pr.user.id,
            pr.user.login,
            createSlackMessageWithSecondaryBlock(createMessage(true), body),
          );

          const message = createSlackMessageWithSecondaryBlock(
            createMessage(false),
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
        } else if (body) {
          const mention = repoContext.slack.mention(reviewer.login);
          const prUrl = repoContext.slack.prLink(pr, context);

          const commentLink = repoContext.slack.link(reviewUrl, 'commented');

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
