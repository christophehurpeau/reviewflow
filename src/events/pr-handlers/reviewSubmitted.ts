import type { Probot } from 'probot';
import slackifyMarkdown from 'slackify-markdown';
import type { SlackMessage } from 'context/slack/SlackMessage';
import type { PostSlackMessageResult } from 'context/slack/TeamSlack';
import type { AccountEmbed } from 'mongo';
import type { AppContext } from '../../context/AppContext';
import * as slackUtils from '../../slack/utils';
import { ExcludesNullish } from '../../utils/Excludes';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { createSlackMessageWithSecondaryBlock } from './utils/createSlackMessageWithSecondaryBlock';
import { fetchPr } from './utils/fetchPr';
import { getReviewersAndReviewStates } from './utils/getReviewersAndReviewStates';
import { getRolesFromPullRequestAndReviewers } from './utils/getRolesFromPullRequestAndReviewers';

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
  const saveInDb = async (
    reviewId: number,
    accountEmbed: AccountEmbed,
    results: PostSlackMessageResult[],
    message: SlackMessage,
  ): Promise<void> => {
    const filtered = results.filter(ExcludesNullish);
    if (filtered.length === 0) return;

    await appContext.mongoStores.slackSentMessages.insertOne({
      type: 'review-submitted',
      typeId: reviewId,
      message,
      account: accountEmbed,
      sentTo: filtered,
    });
  };

  createPullRequestHandler(
    app,
    appContext,
    'pull_request_review.submitted',
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
        id: reviewId,
        html_url: reviewUrl,
      } = payload.review;

      const { reviewers, reviewStates } = await getReviewersAndReviewStates(
        context,
        repoContext,
      );
      const { owner, assignees, followers } =
        getRolesFromPullRequestAndReviewers(pullRequest, reviewers, {
          excludeIds: [reviewer.id],
        });
      const isReviewByOwner = owner.login === reviewer.login;

      if (!isReviewByOwner) {
        const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);
        let merged: boolean;

        if (
          reviewflowPrContext &&
          !repoContext.shouldIgnore &&
          reviewerGroup &&
          repoContext.config.labels.review[reviewerGroup]
        ) {
          const updatedPr = await fetchPr(context, pullRequest.number);
          const hasRequestedReviewsForGroup = repoContext.approveShouldWait(
            reviewerGroup,
            updatedPr,
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
            updatedPr,
            context,
            appContext,
            repoContext,
            reviewflowPrContext,
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

        if (assignees) {
          assignees.forEach((assignee) => {
            repoContext.slack.updateHome(assignee.login);
          });
        }
        repoContext.slack.updateHome(reviewer.login);

        const sentMessageRequestedReview =
          await appContext.mongoStores.slackSentMessages.findOne({
            'account.id': repoContext.accountEmbed.id,
            'account.type': repoContext.accountEmbed.type,
            type: 'review-requested',
            typeId: `${pullRequest.id}_${reviewer.id}`,
          });

        const emoji = getEmojiFromState(state);

        if (sentMessageRequestedReview) {
          const sentTo = sentMessageRequestedReview.sentTo[0];
          const message = sentMessageRequestedReview.message;
          await Promise.all([
            repoContext.slack.updateMessage(
              sentMessageRequestedReview.account,
              sentTo.ts,
              sentTo.channel,
              {
                ...message,
                text: message.text
                  .split('\n')
                  .map((l) => `~${l}~`)
                  .join('\n'),
              },
            ),
            repoContext.slack.addReaction(
              sentMessageRequestedReview.account,
              sentTo.ts,
              sentTo.channel,
              emoji,
            ),
            appContext.mongoStores.slackSentMessages.deleteOne(
              sentMessageRequestedReview,
            ),
          ]);
        }

        const mention = repoContext.slack.mention(reviewer.login);
        const prUrl = slackUtils.createPrLink(pullRequest, repoContext);
        const ownerMention = repoContext.slack.mention(owner.login);

        const createMessage = (
          toOwner?: boolean,
          isAssignedTo?: boolean,
        ): string => {
          const ownerPart = toOwner
            ? 'your PR'
            : `${ownerMention}'s PR${
                isAssignedTo ? " you're assigned to" : ''
              }`;

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

        const slackifiedBody = slackifyMarkdown(body as unknown as string);

        const messageToOwner = createSlackMessageWithSecondaryBlock(
          createMessage(true, true),
          slackifiedBody,
        );
        const messageToAssignee = createSlackMessageWithSecondaryBlock(
          createMessage(false, true),
          slackifiedBody,
        );
        const messageToFollower = createSlackMessageWithSecondaryBlock(
          createMessage(false),
          slackifiedBody,
        );

        await Promise.all([
          Promise.all(
            assignees
              .filter((assignee) => assignee.id === owner.id)
              .map((assigneeIsOwner) => {
                return repoContext.slack.postMessage(
                  'pr-review',
                  assigneeIsOwner,
                  messageToOwner,
                );
              }),
          ).then((results) => {
            return saveInDb(
              reviewId,
              repoContext.accountEmbed,
              results,
              messageToOwner,
            );
          }),

          Promise.all(
            assignees
              .filter((assignee) => assignee.id !== owner.id)
              .map((assignee) => {
                return repoContext.slack.postMessage(
                  'pr-review',
                  assignee,
                  messageToAssignee,
                );
              }),
          ).then((results) => {
            return saveInDb(
              reviewId,
              repoContext.accountEmbed,
              results,
              messageToAssignee,
            );
          }),

          Promise.all(
            followers.map((follower) => {
              return repoContext.slack.postMessage(
                'pr-review-follow',
                follower,
                messageToFollower,
              );
            }),
          ).then((results) => {
            return saveInDb(
              reviewId,
              repoContext.accountEmbed,
              results,
              messageToFollower,
            );
          }),
        ]);
      } else if (body) {
        const mention = repoContext.slack.mention(reviewer.login);
        const prUrl = slackUtils.createPrLink(pullRequest, repoContext);
        const commentLink = slackUtils.createLink(reviewUrl, 'commented');

        const message = createSlackMessageWithSecondaryBlock(
          `:speech_balloon: ${mention} ${commentLink} on his PR ${prUrl}`,
          body,
        );

        await Promise.all([
          Promise.all(
            assignees
              .filter((assignee) => assignee.id !== reviewer.id)
              .map((assignee) => {
                return repoContext.slack.postMessage(
                  'pr-review',
                  assignee,
                  message,
                );
              }),
          ).then((results) => {
            return saveInDb(
              reviewId,
              repoContext.accountEmbed,
              results,
              message,
            );
          }),

          Promise.all(
            followers
              .filter((follower) => follower.id !== reviewer.id)
              .map((follower) => {
                return repoContext.slack.postMessage(
                  'pr-review-follow',
                  follower,
                  message,
                );
              }),
          ).then((results) => {
            return saveInDb(
              reviewId,
              repoContext.accountEmbed,
              results,
              message,
            );
          }),
        ]);
      }
    },
  );
}
