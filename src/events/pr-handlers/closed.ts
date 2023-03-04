import type { Probot } from 'probot';
import type { AccountInfo } from 'context/getOrCreateAccount';
import type { AppContext } from '../../context/AppContext';
import * as slackUtils from '../../slack/utils';
import { updateCommentBodyProgressFromStepsState } from './actions/updateCommentBodyProgressFromStepsState';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { updateStatusCheckFromStepsState } from './actions/updateStatusCheckFromStepsState';
import { parseOptions } from './actions/utils/body/parseBody';
import { calcStepsState } from './actions/utils/steps/calcStepsState';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { getReviewersAndReviewStates } from './utils/getReviewersAndReviewStates';
import { getRolesFromPullRequestAndReviewers } from './utils/getRolesFromPullRequestAndReviewers';

export default function closed(app: Probot, appContext: AppContext): void {
  createPullRequestHandler(
    app,
    appContext,
    'pull_request.closed',
    (payload) => payload.pull_request,
    async (pullRequest, context, repoContext, reviewflowPrContext) => {
      /* if repo is not ignored */
      if (reviewflowPrContext) {
        /* update status, update automerge queue, delete branch */
        const repo = context.payload.repository;

        const stepsState = calcStepsState({
          repoContext,
          pullRequest,
          reviewflowPrContext,
        });

        if ((pullRequest as any).merged) {
          const isNotFork = pullRequest.head.repo.id === repo.id;
          const options = parseOptions(
            reviewflowPrContext.commentBody,
            repoContext.config.prDefaultOptions,
          );

          await Promise.all([
            repoContext.removePrFromAutomergeQueue(
              context,
              pullRequest,
              'pr closed',
            ),
            isNotFork && options.deleteAfterMerge
              ? context.octokit.git
                  .deleteRef(
                    context.repo({ ref: `heads/${pullRequest.head.ref}` }),
                  )
                  .catch(() => {})
              : undefined,
            updateCommentBodyProgressFromStepsState(
              stepsState,
              context,
              reviewflowPrContext,
            ),
          ]);
        } else {
          await Promise.all([
            repoContext.removePrFromAutomergeQueue(
              context,
              pullRequest,
              'pr closed',
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
            updateCommentBodyProgressFromStepsState(
              stepsState,
              context,
              reviewflowPrContext,
            ),
          ]);
        }
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

        return `${
          (pullRequest as any).merged
            ? `:rocket: ${senderMention} merged`
            : `:wastebasket: ${senderMention} closed`
        } ${ownerPart} ${prLink}\n> ${pullRequest.title}`;
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
