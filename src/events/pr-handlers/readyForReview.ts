import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import * as slackUtils from '../../slack/utils';
import { ExcludesFalsy } from '../../utils/Excludes';
import { editOpenedPR } from './actions/editOpenedPR';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { updateStatusCheckFromStepsState } from './actions/updateStatusCheckFromStepsState';
import { calcStepsState } from './actions/utils/steps/calcStepsState';
import { createPullRequestHandler } from './utils/createPullRequestHandler';

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

      const requestedReviewerGroups = [
        ...new Set([
          ...pullRequest.requested_reviewers.map((requestedReviewer) =>
            repoContext.getReviewerGroup((requestedReviewer as any).login),
          ),
          ...pullRequest.requested_teams.map((requestedTeam) =>
            repoContext.getTeamGroup(requestedTeam.name),
          ),
        ]),
      ].filter(ExcludesFalsy);

      /* if repo is not ignored */
      if (reviewflowPrContext) {
        const newLabels = await updateReviewStatus(
          pullRequest,
          context,
          repoContext,
          [
            ...requestedReviewerGroups.map((reviewGroup) => ({
              reviewGroup,
              add: ['needsReview', 'requested'],
            })),
            ...(!requestedReviewerGroups.includes('dev') &&
            repoContext.config.requiresReviewRequest
              ? [
                  {
                    reviewGroup: 'dev',
                    add: ['needsReview'],
                  },
                ]
              : ([] as any)),
          ],
        );
        await editOpenedPR({
          pullRequest,
          context,
          appContext,
          repoContext,
          reviewflowPrContext,
          shouldUpdateCommentBodyInfos: true,
        });

        const stepsState = calcStepsState({
          repoContext,
          pullRequest,
          labels: newLabels,
        });

        await updateStatusCheckFromStepsState(
          stepsState,
          pullRequest,
          context,
          appContext,
          reviewflowPrContext,
        );
      }

      /* update slack home */
      const loginsAskedToUpdateSlackHome: string[] = [];
      if (pullRequest.assignees) {
        pullRequest.assignees.forEach((assignee) => {
          loginsAskedToUpdateSlackHome.push(assignee.login);
          repoContext.slack.updateHome(assignee.login);
        });
      }

      pullRequest.requested_reviewers.forEach((requestedReviewer: any) => {
        if (loginsAskedToUpdateSlackHome.includes(requestedReviewer.login)) {
          return;
        }

        loginsAskedToUpdateSlackHome.push(requestedReviewer.login);
        repoContext.slack.updateHome(requestedReviewer.login);
      });

      membersForTeams.forEach(({ members }) => {
        members.forEach((teamMember) => {
          if (loginsAskedToUpdateSlackHome.includes(teamMember.login)) {
            return;
          }

          loginsAskedToUpdateSlackHome.push(teamMember.login);
          repoContext.slack.updateHome(teamMember.login);
        });
      });

      /* send slack notification */
      if (repoContext.slack) {
        const createText = ({
          requestedTeam,
        }: {
          requestedTeam?: typeof pullRequest.requested_teams[number];
        }): string =>
          `:eyes: ${repoContext.slack.mention(
            sender.login,
          )} marked as ready to review and requests ${
            !requestedTeam ? 'your' : `your team _${requestedTeam.name}_`
          } review on ${slackUtils.createPrLink(
            pullRequest,
            repoContext,
          )} !\n> ${pullRequest.title}`;

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
                typeId: `${pullRequest.id}_${''}${potentialReviewer.id}`,
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
