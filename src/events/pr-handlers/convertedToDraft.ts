import type { Probot } from "probot";
import type { AppContext } from "../../context/AppContext.ts";
import * as slackUtils from "../../slack/utils.ts";
import { editOpenedPR } from "./actions/editOpenedPR.ts";
import { updateReviewStatus } from "./actions/updateReviewStatus.ts";
import { updateStatusCheckFromStepsState } from "./actions/updateStatusCheckFromStepsState.ts";
import { calcStepsState } from "./actions/utils/steps/calcStepsState.ts";
import { updateSlackHomeForPr } from "./actions/utils/updateSlackHome.ts";
import { createPullRequestHandler } from "./utils/createPullRequestHandler.ts";
import { getReviewersAndReviewStates } from "./utils/getReviewersAndReviewStates.ts";
import { getRolesFromPullRequestAndReviewers } from "./utils/getRolesFromPullRequestAndReviewers.ts";

export default function convertedToDraft(
  app: Probot,
  appContext: AppContext,
): void {
  createPullRequestHandler(
    app,
    appContext,
    "pull_request.converted_to_draft",
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
                isDraft: true,
              },
              $unset: reviewflowPrContext.reviewflowPr.flowDates?.readyAt
                ? {
                    "flowDates.readyAt": true,
                  }
                : undefined,
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
            shouldUpdateCommentBodyInfos: true,
            shouldUpdateCommentBodyProgress: true,
          }),
        ]);
      }

      const sender = context.payload.sender;

      const { reviewers } = await getReviewersAndReviewStates(context);
      const { owner, assignees, followers } =
        getRolesFromPullRequestAndReviewers(pullRequest, reviewers, {
          excludeIds: [sender.id],
        });

      const teamMembers = await repoContext.getMembersForTeams(
        pullRequest.requested_teams
          ? pullRequest.requested_teams.map((team) => team.id)
          : [],
      );
      updateSlackHomeForPr(repoContext, pullRequest, {
        assignees: true,
        requestedReviewers: true,
        requestedTeams: true,
        teamMembers,
      });

      const mention = repoContext.slack.mention(sender.login);
      const prUrl = slackUtils.createPrLink(pullRequest, repoContext);
      const ownerMention = repoContext.slack.mention(owner.login);
      const createMessage = (
        toOwner?: boolean,
        isAssignedTo?: boolean,
      ): string => {
        const ownerPart = toOwner
          ? "your PR"
          : `${sender.id === owner.id ? "his" : `${ownerMention}'s`} PR${
              isAssignedTo ? " you're assigned to" : ""
            }`;

        return `:ghost: ${mention} marked ${ownerPart} ${prUrl} as draft`;
      };

      const messageToOwner = { text: createMessage(true, true) };
      const messageToAssignee = { text: createMessage(false, true) };
      const messageToFollower = { text: createMessage(false) };

      await Promise.all([
        ...assignees
          .filter((assignee) => assignee.id === owner.id)
          .map((assigneeIsOwner) => {
            return repoContext.slack.postMessage(
              "pr-lifecycle",
              assigneeIsOwner,
              messageToOwner,
            );
          }),

        ...assignees
          .filter((assignee) => assignee.id !== owner.id)
          .map((assignee) => {
            return repoContext.slack.postMessage(
              "pr-lifecycle",
              assignee,
              messageToAssignee,
            );
          }),

        ...followers.map((follower) => {
          return repoContext.slack.postMessage(
            "pr-lifecycle-follow",
            follower,
            messageToFollower,
          );
        }),
      ]);
    },
  );
}
