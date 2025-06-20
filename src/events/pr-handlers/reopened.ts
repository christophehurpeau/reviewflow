import type { Probot } from "probot";
import type { AppContext } from "../../context/AppContext.ts";
import * as slackUtils from "../../slack/utils.ts";
import type { CreateOwnerPartOptions } from "../../slack/utils.ts";
import { editOpenedPR } from "./actions/editOpenedPR.ts";
import { updateReviewStatus } from "./actions/updateReviewStatus.ts";
import { updateStatusCheckFromStepsState } from "./actions/updateStatusCheckFromStepsState.ts";
import { calcStepsState } from "./actions/utils/steps/calcStepsState.ts";
import { updateSlackHomeForPr } from "./actions/utils/updateSlackHome.ts";
import { createPullRequestHandler } from "./utils/createPullRequestHandler.ts";
import { getReviewersAndReviewStates } from "./utils/getReviewersAndReviewStates.ts";
import { getRolesFromPullRequestAndReviewers } from "./utils/getRolesFromPullRequestAndReviewers.ts";

export default function reopened(app: Probot, appContext: AppContext): void {
  createPullRequestHandler(
    app,
    appContext,
    "pull_request.reopened",
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
              $set: {
                isDraft: pullRequest.draft === true,
                ...(reviewflowPrContext.reviewflowPr.flowDates
                  ? {
                      "flowDates.readyAt": new Date(),
                    }
                  : {
                      flowDates: {
                        createdAt: new Date(pullRequest.created_at),
                        openedAt: new Date(),
                        readyAt: pullRequest.draft ? undefined : new Date(),
                      },
                    }),
              },
              $unset: reviewflowPrContext.reviewflowPr.flowDates?.closedAt
                ? {
                    "flowDates.closedAt": true,
                  }
                : {},
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
      const teamMembers = await repoContext.getMembersForTeams(
        pullRequest.requested_teams.map((team) => team.id),
      );
      updateSlackHomeForPr(repoContext, pullRequest, {
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
        const ownerPart = slackUtils.createOwnerPart(repoContext, pullRequest, {
          ...createOwnerPartOptions,
          isSender: context.payload.sender.login === owner.login,
        });

        return `:recycle: ${senderMention} reopened ${ownerPart} ${prLink}\n> ${pullRequest.title}`;
      };

      if (context.payload.sender.id !== owner.id) {
        repoContext.slack.postMessage("pr-lifecycle", owner, {
          text: createMessage({ isOwner: true }),
        });
      }

      assigneesNotOwner.map((assignee) => {
        if (context.payload.sender.id === assignee.id) return undefined;
        return repoContext.slack.postMessage("pr-lifecycle", assignee, {
          text: createMessage({ isAssigned: true }),
        });
      });

      followers.map((follower) => {
        if (context.payload.sender.id === follower.id) return undefined;
        return repoContext.slack.postMessage("pr-lifecycle-follow", follower, {
          text: createMessage({}),
        });
      });
    },
  );
}
