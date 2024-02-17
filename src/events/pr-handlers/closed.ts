import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import * as slackUtils from '../../slack/utils';
import type { CreateOwnerPartOptions } from '../../slack/utils';
import { updateCommentBodyProgressFromStepsState } from './actions/updateCommentBodyProgressFromStepsState';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { updateStatusCheckFromStepsState } from './actions/updateStatusCheckFromStepsState';
import { parseOptions } from './actions/utils/body/parseBody';
import { calcStepsState } from './actions/utils/steps/calcStepsState';
import { updateSlackHomeForPr } from './actions/utils/updateSlackHome';
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

        const updateClosedPromise = appContext.mongoStores.prs.partialUpdateOne(
          reviewflowPrContext.reviewflowPr,
          {
            $set: {
              isClosed: true,
              ...(reviewflowPrContext.reviewflowPr.flowDates
                ? { 'flowDates.closedAt': new Date(pullRequest.closed_at!) }
                : {
                    flowDates: {
                      createdAt: new Date(pullRequest.created_at),
                      openedAt: new Date(pullRequest.created_at),
                      closedAt: new Date(pullRequest.closed_at!),
                    },
                  }),
            },
          },
        );

        if ((pullRequest as any).merged) {
          const isNotFork = pullRequest.head.repo?.id === repo.id;
          const options = parseOptions(
            reviewflowPrContext.commentBody,
            repoContext.config.prDefaultOptions,
          );

          await Promise.all([
            updateClosedPromise,
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
            updateClosedPromise,
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
      const teamMembers = await repoContext.getMembersForTeams(
        pullRequest.requested_teams.map((team) => team.id),
      );
      updateSlackHomeForPr(repoContext, pullRequest, {
        user: true,
        assignees: true,
        requestedReviewers: true,
        requestedTeams: true,
        teamMembers,
      });

      /* send notifications to assignees and followers */
      const { reviewers } = await getReviewersAndReviewStates(context);
      const { owner, assigneesNotOwner, followers } =
        getRolesFromPullRequestAndReviewers(pullRequest, reviewers);

      const senderMention = repoContext.slack.mention(
        context.payload.sender.login,
      );
      const prLink = slackUtils.createPrLink(pullRequest, repoContext);

      const createMessage = (
        createOwnerPartOptions: CreateOwnerPartOptions,
      ): string => {
        const ownerPart = slackUtils.createOwnerPart(
          repoContext,
          pullRequest,
          createOwnerPartOptions,
        );

        return `${
          (pullRequest as any).merged
            ? `:rocket: ${senderMention} merged`
            : `:wastebasket: ${senderMention} closed`
        } ${ownerPart} ${prLink}\n> ${pullRequest.title}`;
      };
      if (context.payload.sender.id !== owner.id) {
        repoContext.slack.postMessage('pr-lifecycle', owner, {
          text: createMessage({ isOwner: true }),
        });
      }

      assigneesNotOwner.map((assignee) => {
        if (context.payload.sender.id === assignee.id) return;
        return repoContext.slack.postMessage('pr-lifecycle', assignee, {
          text: createMessage({ isAssigned: true }),
        });
      });

      followers.map((follower) => {
        if (context.payload.sender.id === follower.id) return;
        return repoContext.slack.postMessage('pr-lifecycle-follow', follower, {
          text: createMessage({}),
        });
      });
    },
  );
}
