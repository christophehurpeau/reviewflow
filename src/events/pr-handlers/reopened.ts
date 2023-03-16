import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import type { AccountInfo } from '../../context/getOrCreateAccount';
import * as slackUtils from '../../slack/utils';
import { editOpenedPR } from './actions/editOpenedPR';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { updateStatusCheckFromStepsState } from './actions/updateStatusCheckFromStepsState';
import { calcStepsState } from './actions/utils/steps/calcStepsState';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { getReviewersAndReviewStates } from './utils/getReviewersAndReviewStates';
import { getRolesFromPullRequestAndReviewers } from './utils/getRolesFromPullRequestAndReviewers';

export default function reopened(app: Probot, appContext: AppContext): void {
  createPullRequestHandler(
    app,
    appContext,
    'pull_request.reopened',
    (payload, context, repoContext) => {
      return payload.pull_request;
    },
    async (
      pullRequest,
      context,
      repoContext,
      reviewflowPrContext,
    ): Promise<void> => {
      /* if repo is not ignored */
      if (reviewflowPrContext) {
        const stepsState = calcStepsState({
          repoContext,
          pullRequest,
          reviewflowPrContext,
        });

        await Promise.all([
          appContext.mongoStores.prs.partialUpdateOne(
            reviewflowPrContext.reviewflowPr,
            {
              $set: { isDraft: pullRequest.draft === true },
            },
          ),
          updateReviewStatus(pullRequest, context, repoContext, stepsState),
          updateStatusCheckFromStepsState(
            stepsState,
            pullRequest,
            context,
            repoContext,
            appContext,
            reviewflowPrContext,
          ),
          editOpenedPR({
            pullRequest,
            context,
            appContext,
            repoContext,
            reviewflowPrContext,
            stepsState,
            shouldUpdateCommentBodyProgress: true,
            shouldUpdateCommentBodyInfos: true,
          }),
        ]);
      }

      /* update slack home */
      if (pullRequest.requested_reviewers) {
        pullRequest.requested_reviewers.forEach((requestedReviewer) => {
          if (!('login' in requestedReviewer)) return;
          repoContext.slack.updateHome(requestedReviewer.login);
        });
      }

      if (pullRequest.requested_teams) {
        const members = await repoContext.getMembersForTeams(
          pullRequest.requested_teams.map((team) => team.id),
        );
        members.forEach((member) => {
          repoContext.slack.updateHome(member.login);
        });
      }

      if (pullRequest.assignees) {
        pullRequest.assignees.forEach((assignee) => {
          repoContext.slack.updateHome(assignee.login);
        });
      }

      /* send notifications to assignees and followers */
      const { reviewers } = await getReviewersAndReviewStates(context);
      const { owner, assignees, followers } =
        getRolesFromPullRequestAndReviewers(pullRequest, reviewers);

      const senderMention = repoContext.slack.mention(
        context.payload.sender.login,
      );
      const ownerMention = repoContext.slack.mention(owner.login);
      const prLink = slackUtils.createPrLink(pullRequest, repoContext);

      const createMessage = (to: AccountInfo): string => {
        const ownerPart = slackUtils.createOwnerPart(
          ownerMention,
          pullRequest,
          to,
        );

        return `:recycle: ${senderMention} reopened ${ownerPart} ${prLink}\n> ${pullRequest.title}`;
      };

      assignees.map((assignee) => {
        if (context.payload.sender.id === assignee.id) return;
        return repoContext.slack.postMessage('pr-lifecycle', assignee, {
          text: createMessage(assignee),
        });
      });

      followers.map((follower) => {
        if (context.payload.sender.id === follower.id) return;
        return repoContext.slack.postMessage('pr-lifecycle-follow', follower, {
          text: createMessage(follower),
        });
      });
    },
  );
}
