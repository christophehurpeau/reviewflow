import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import * as slackUtils from '../../slack/utils';
import { editOpenedPR } from './actions/editOpenedPR';
import { mergeOrEnableGithubAutoMerge } from './actions/enableGithubAutoMerge';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { updateStatusCheckFromStepsState } from './actions/updateStatusCheckFromStepsState';
import hasLabelInPR from './actions/utils/labels/hasLabelInPR';
import { calcStepsState } from './actions/utils/steps/calcStepsState';
import { updateSlackHomeForPr } from './actions/utils/updateSlackHome';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { fetchPr, type PullRequestFromRestEndpoint } from './utils/fetchPr';

export default function readyForReview(
  app: Probot,
  appContext: AppContext,
): void {
  createPullRequestHandler(
    app,
    appContext,
    'pull_request.ready_for_review',
    (payload, context, repoContext) => {
      return payload.pull_request;
    },
    async (
      pullRequest,
      context,
      repoContext,
      reviewflowPrContext,
    ): Promise<void> => {
      const sender = context.payload.sender;

      const membersForTeams = await Promise.all(
        pullRequest.requested_teams.map(async (requestedTeam) => ({
          requestedTeam,
          members: await repoContext.getMembersForTeams([requestedTeam.id]),
        })),
      );

      let updatedPullRequest: PullRequestFromRestEndpoint | undefined;

      /* if repo is not ignored */
      if (reviewflowPrContext) {
        const autoMergeLabel = repoContext.labels['merge/automerge'];
        const stepsState = calcStepsState({
          repoContext,
          pullRequest,
          reviewflowPrContext,
        });

        const [updatedPr] = await Promise.all([
          fetchPr(context, pullRequest.number),
          updateReviewStatus(pullRequest, context, repoContext, stepsState),
          editOpenedPR({
            stepsState,
            pullRequest,
            context,
            appContext,
            repoContext,
            reviewflowPrContext,
            shouldUpdateCommentBodyInfos: true,
            shouldUpdateCommentBodyProgress: true,
          }),
          updateStatusCheckFromStepsState(
            stepsState,
            pullRequest,
            context,
            repoContext,
            appContext,
            reviewflowPrContext,
          ).then(async (statusCheckResult) => {
            if (
              repoContext.settings.allowAutoMerge &&
              hasLabelInPR(pullRequest.labels, autoMergeLabel)
            ) {
              await mergeOrEnableGithubAutoMerge(
                pullRequest,
                context,
                repoContext,
                reviewflowPrContext,
                undefined,
                statusCheckResult === 'failure',
              );
            }
          }),
        ]);
        updatedPullRequest = updatedPr;
      }

      /* update slack home */
      updateSlackHomeForPr(repoContext, pullRequest, {
        assignees: true,
        requestedReviewers: true,
        requestedTeams: true,
        teamMembers: membersForTeams.flatMap(({ members }) => members),
      });

      /* send slack notification */
      if (repoContext.slack) {
        const prChangesInformation =
          updatedPullRequest &&
          slackUtils.createPrChangesInformationFromPullRequestRest(
            updatedPullRequest,
          );
        const createText = ({
          requestedTeam,
        }: {
          requestedTeam?: (typeof pullRequest.requested_teams)[number];
        }): string =>
          `:eyes: ${repoContext.slack.mention(
            sender.login,
          )} marked as ready to review and requests ${
            !requestedTeam ? 'your' : `your team _${requestedTeam.name}_`
          } review on ${slackUtils.createPrLink(pullRequest, repoContext)}${
            prChangesInformation ? ` · ${prChangesInformation}` : ''
          }\n> ${pullRequest.title}`;

        const messageRequestedReviewers = {
          text: createText({}),
        };

        await Promise.all([
          ...pullRequest.requested_reviewers.map(async (potentialReviewer) => {
            if (sender.id === potentialReviewer.id) return;

            const result = await repoContext.slack.postMessage(
              'pr-review',
              potentialReviewer as any,
              messageRequestedReviewers,
              // requestedTeam ? requestedTeam.id : undefined,
              undefined,
            );
            if (result) {
              await appContext.mongoStores.slackSentMessages.insertOne({
                type: 'review-requested',
                typeId: `${pullRequest.id}_${potentialReviewer.id}`,
                message: messageRequestedReviewers,
                account: repoContext.accountEmbed,
                sentTo: [result],
              });
            }
          }),
          ...membersForTeams.map(({ requestedTeam, members }) => {
            const message = { text: createText({ requestedTeam }) };

            return Promise.all(
              members.map(async (potentialReviewer) => {
                if (sender.login === potentialReviewer.login) return;

                const result = await repoContext.slack.postMessage(
                  'pr-review',
                  potentialReviewer as any,
                  message,
                  requestedTeam.id,
                );
                if (result) {
                  await appContext.mongoStores.slackSentMessages.insertOne({
                    type: 'review-requested',
                    typeId: `${pullRequest.id}_${`${requestedTeam.id}_`}${
                      potentialReviewer.id
                    }`,
                    message,
                    account: repoContext.accountEmbed,
                    sentTo: [result],
                  });
                }
              }),
            );
          }),
        ]);
      }
    },
  );
}
