import type { Probot } from "probot";
import slackifyMarkdown from "slackify-markdown";
import type { AppContext } from "../../context/AppContext";
import type { SlackMessage } from "../../context/slack/SlackMessage";
import type { PostSlackMessageResult } from "../../context/slack/TeamSlack";
import type { AccountEmbed } from "../../mongo";
import * as slackUtils from "../../slack/utils";
import { ExcludesNullish } from "../../utils/Excludes";
import { getReviewsState } from "../../utils/github/pullRequest/reviews";
import { createSlackMessageWithSecondaryBlock } from "../../utils/slack/createSlackMessageWithSecondaryBlock";
import { updateAfterReviewChange } from "./actions/updateAfterReviewChange";
import { updateSlackHomeForPr } from "./actions/utils/updateSlackHome";
import { createPullRequestHandler } from "./utils/createPullRequestHandler";
import { fetchPr } from "./utils/fetchPr";
import { getReviewersAndReviewStates } from "./utils/getReviewersAndReviewStates";
import { getRolesFromPullRequestAndReviewers } from "./utils/getRolesFromPullRequestAndReviewers";

const getEmojiFromState = (state: string): string => {
  switch (state) {
    case "changes_requested":
      return "x";
    case "approved":
      return "white_check_mark";
    default:
      return "speech_balloon";
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
      type: "review-submitted",
      typeId: reviewId,
      message,
      account: accountEmbed,
      sentTo: filtered,
    });
  };

  createPullRequestHandler(
    app,
    appContext,
    "pull_request_review.submitted",
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

      const [{ reviewers }, reviewerGithubTeams] = await Promise.all([
        getReviewersAndReviewStates(context),
        repoContext.accountEmbed.type !== "Organization"
          ? []
          : repoContext.getGithubTeamsForMember(reviewer.id),
      ]);
      const { owner, assignees, followers } =
        getRolesFromPullRequestAndReviewers(pullRequest, reviewers, {
          excludeIds: [reviewer.id],
        });
      const isReviewByOwner = owner.login === reviewer.login;

      if (!isReviewByOwner) {
        let merged: boolean;

        if (reviewflowPrContext && !repoContext.shouldIgnore) {
          const [updatedPr, reviewsState] = await Promise.all([
            fetchPr(context, pullRequest.number),
            getReviewsState(context, pullRequest),
          ]);

          await updateAfterReviewChange(
            updatedPr,
            context,
            appContext,
            repoContext,
            reviewflowPrContext,
            reviewsState,
          );
        }

        const createTeamsRegex = () => {
          if (reviewerGithubTeams.length === 1) {
            return reviewerGithubTeams[0].id;
          }
          return `(${reviewerGithubTeams.map((team) => team.id).join("|")})`;
        };

        const [
          sentMessageRequestedReview,
          sentMessageRequestedReviewForReviewerTeams,
        ] = await Promise.all([
          appContext.mongoStores.slackSentMessages.findOne(
            {
              "account.id": repoContext.accountEmbed.id,
              "account.type": repoContext.accountEmbed.type,
              type: "review-requested",
              typeId: `${pullRequest.id}_${reviewer.id}`,
            } as const,
            { created: -1 },
          ),
          reviewerGithubTeams.length > 0
            ? appContext.mongoStores.slackSentMessages.findAll(
                {
                  "account.id": repoContext.accountEmbed.id,
                  "account.type": repoContext.accountEmbed.type,
                  type: "review-requested",
                  typeId: {
                    $regex: `^${pullRequest.id}_${createTeamsRegex()}_`,
                  },
                } as const,
                { created: -1 },
              )
            : [],
        ]);

        updateSlackHomeForPr(repoContext, pullRequest, {
          assignees: true,
          otherLogins: [
            reviewer.login,
            ...sentMessageRequestedReviewForReviewerTeams.flatMap(
              ({ sentTo }) => sentTo.map(({ user }) => user.login),
            ),
          ],
        });

        const emoji = getEmojiFromState(state);

        if (
          sentMessageRequestedReview ||
          sentMessageRequestedReviewForReviewerTeams.length > 0
        ) {
          await Promise.all([
            ...(sentMessageRequestedReview
              ? [
                  ...sentMessageRequestedReview.sentTo.map((sentTo) => [
                    repoContext.slack.updateMessage(
                      sentTo.user,
                      sentTo.ts,
                      sentTo.channel,
                      {
                        ...sentMessageRequestedReview.message,
                        text: sentMessageRequestedReview.message.text
                          .split("\n")
                          .map((l) => `~${l}~`)
                          .join("\n"),
                      },
                    ),
                    repoContext.slack.addReaction(
                      sentTo.user,
                      sentTo.ts,
                      sentTo.channel,
                      emoji,
                    ),
                  ]),
                  appContext.mongoStores.slackSentMessages.deleteOne(
                    sentMessageRequestedReview,
                  ),
                ]
              : []),
            ...sentMessageRequestedReviewForReviewerTeams.flatMap(
              (sentMessageRequestedReviewForReviewerTeam) => [
                ...sentMessageRequestedReviewForReviewerTeam.sentTo.map(
                  (sentTo) => [
                    repoContext.slack.updateMessage(
                      sentTo.user,
                      sentTo.ts,
                      sentTo.channel,
                      {
                        ...sentMessageRequestedReviewForReviewerTeam.message,
                        text: sentMessageRequestedReviewForReviewerTeam.message.text
                          .split("\n")
                          .map((l) => `~${l}~`)
                          .join("\n"),
                      },
                    ),
                    repoContext.slack.addReaction(
                      sentTo.user,
                      sentTo.ts,
                      sentTo.channel,
                      emoji,
                    ),
                  ],
                ),
                appContext.mongoStores.slackSentMessages.deleteOne(
                  sentMessageRequestedReviewForReviewerTeam,
                ),
              ],
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
            ? "your PR"
            : `${ownerMention}'s PR${
                isAssignedTo ? " you're assigned to" : ""
              }`;

          if (state === "changes_requested") {
            return `:${emoji}: ${mention} requests changes on ${ownerPart} ${prUrl}\n> ${pullRequest.title}`;
          }
          if (state === "approved") {
            return `${
              toOwner ? ":clap: " : ""
            }:${emoji}: ${mention} approves ${ownerPart} ${prUrl}${
              merged ? " and PR is merged :tada:" : ""
            }\n> ${pullRequest.title}`;
          }

          const commentLink = slackUtils.createLink(reviewUrl, "commented");
          return `:${emoji}: ${mention} ${commentLink} on ${ownerPart} ${prUrl}\n> ${pullRequest.title}`;
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
                  "pr-review",
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
                  "pr-review",
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
                "pr-review-follow",
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
        const commentLink = slackUtils.createLink(reviewUrl, "commented");

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
                  "pr-review",
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
                  "pr-review-follow",
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
