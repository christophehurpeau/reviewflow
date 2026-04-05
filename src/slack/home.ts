import type { KnownBlock } from "@slack/web-api";
import { WebClient } from "@slack/web-api";
import type { Probot } from "probot";
import type { MongoStores, Org, OrgMember } from "../mongo.ts";
import type { OctokitRestCompat } from "../octokit.ts";
import {
  buildBlocksForDataFromGithubAndMongo,
  buildBlocksForDataFromMongo,
} from "./homeHelpers.ts";
import { createLink } from "./utils.ts";

interface QueueItem {
  octokitRest: OctokitRestCompat;
  slackClient: WebClient;
  member: OrgMember;
}

// helpers are in src/slack/homeHelpers.ts

export const createSlackHomeWorker = (
  mongoStores: MongoStores,
  log: Probot["log"],
) => {
  const updateMember = async (
    octokitRest: OctokitRestCompat,
    slackClient: WebClient,
    member: OrgMember,
  ): Promise<void> => {
    if (!member.slack?.id) return;

    /* search limit: 30 requests per minute = 7 update/min max */
    const [
      prsWithRequestedReviewsFromGithub,
      prsWithRequestedReviewsFromMongo,
      prsToMerge,
      prsWithRequestedChanges,
      prsInDraft,
      openedPrsWithNoActionPlanned,
      myOpenedPrsWaitingForRequestedReview,
    ] = await Promise.all([
      //prsWithRequestedReviewsFromGithub
      octokitRest.search
        .issuesAndPullRequests({
          q: `is:pr user:${member.org.login} is:open review-requested:${member.user.login} draft:false`,
          sort: "created",
          order: "desc",
        })
        .catch((error: unknown) => {
          log.error(
            {
              error,
            },
            `Error searching PRs: ${(error as any)?.message}`,
          );
          return undefined;
        }),
      //prsWithRequestedReviewsFromMongo
      mongoStores.prs.findAll(
        {
          "account.id": member.org.id,
          isClosed: false,
          isDraft: false,
          ...(member.teams?.length > 0
            ? {
                $or: [
                  { "reviews.reviewRequested.id": member.user.id },
                  {
                    "reviews.teamReviewRequested.id": {
                      $in: member.teams.map((t) => t.id),
                    },
                  },
                ],
              }
            : { "reviews.reviewRequested.id": member.user.id }),
        },
        // TODO sort by time since asked for review ASC
        { "flowDates.opened": -1, created: -1 },
      ),
      //prsToMerge
      mongoStores.prs.findAll(
        {
          "account.id": member.org.id,
          "assignees.id": member.user.id,
          isClosed: false,
          "reviews.reviewRequested": { $exists: true, $eq: [] },
          "reviews.changesRequested": { $exists: true, $eq: [] },
          "reviews.approved": { $exists: true, $ne: [] },
        },
        { created: -1 },
      ),
      //prsWithRequestedChanges
      mongoStores.prs.findAll(
        {
          "account.id": member.org.id,
          "assignees.id": member.user.id,
          isClosed: false,
          "reviews.changesRequested": { $exists: true, $ne: [] },
        },
        { created: -1 },
      ),
      //prsInDraft
      mongoStores.prs.findAll(
        {
          "account.id": member.org.id,
          "assignees.id": member.user.id,
          isClosed: false,
          isDraft: true,
        },
        { created: -1 },
      ),
      //openedPrsWithNoActionPlanned
      mongoStores.prs.findAll(
        {
          "account.id": member.org.id,
          "assignees.id": member.user.id,
          isClosed: false,
          isDraft: false,
          "reviews.teamReviewRequested": { $not: { $exists: true, $ne: [] } },
          "reviews.reviewRequested": { $not: { $exists: true, $ne: [] } },
          "reviews.changesRequested": { $not: { $exists: true, $ne: [] } },
          "reviews.approved": { $not: { $exists: true, $ne: [] } },
        },
        { created: -1 },
      ),
      //myOpenedPrsWaitingForRequestedReview
      mongoStores.prs.findAll(
        {
          "account.id": member.org.id,
          "assignees.id": member.user.id,
          isClosed: false,
          isDraft: false,
          $or: [
            { "reviews.teamReviewRequested": { $exists: true, $ne: [] } },
            { "reviews.reviewRequested": { $exists: true, $ne: [] } },
          ],
        },
        { created: -1 },
      ),
    ]);

    const baseBlocks: KnownBlock[] = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Configure your ${process.env.REVIEWFLOW_NAME} settings ${createLink(
            `${process.env.REVIEWFLOW_APP_URL}/org/${member.org.login}`,
            "here",
          )}.`,
        },
      },
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "PRs requesting your attention",
        },
      },
    ];

    let blocks: KnownBlock[] = [
      ...baseBlocks,
      ...buildBlocksForDataFromGithubAndMongo(
        member.user.login,
        ":eyes: Requested reviews",
        prsWithRequestedReviewsFromGithub,
        prsWithRequestedReviewsFromMongo,
      ),
      ...buildBlocksForDataFromMongo(
        member.user.login,
        ":white_check_mark: Ready to merge",
        prsToMerge,
      ),
      ...buildBlocksForDataFromMongo(
        member.user.login,
        ":x: Changes requested",
        prsWithRequestedChanges,
      ),
    ];

    if (prsInDraft.length > 0) {
      blocks = [
        ...blocks,
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "Your PRs in progress",
          },
        },
        ...buildBlocksForDataFromMongo(
          member.user.login,
          ":construction: Your drafts PRs",
          prsInDraft,
        ),
      ];
    }

    if (openedPrsWithNoActionPlanned.length > 0) {
      blocks = [
        ...blocks,
        ...buildBlocksForDataFromMongo(
          member.user.login,
          ":warning: Your opened PRs missing a request for review",
          openedPrsWithNoActionPlanned,
        ),
      ];
    }
    if (myOpenedPrsWaitingForRequestedReview.length > 0) {
      blocks = [
        ...blocks,
        ...buildBlocksForDataFromMongo(
          member.user.login,
          ":clock1: Your opened PRs waiting for a review",
          myOpenedPrsWaitingForRequestedReview,
        ),
      ];
    }

    if (blocks.length === 2) {
      blocks = [
        ...blocks,
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: ":tada: It looks like you don't have any PR to review!",
          },
        },
      ];
    }

    slackClient.views
      .publish({
        user_id: member.slack.id,
        view: {
          type: "home",
          blocks,
        },
      })
      .catch((error: unknown) => {
        log.error(
          {
            error,
            memberLogin: member.user.login,
            orgLogin: member.org.login,
            blocks,
          },
          `Error updating home: ${(error as any)?.message}`,
        );
      });
  };

  let workerInterval: ReturnType<typeof setInterval> | undefined;
  const queueKeys = new Set<string>();
  const queue: QueueItem[] = [];

  const stop = (): void => {
    if (workerInterval !== undefined) {
      clearInterval(workerInterval);
      workerInterval = undefined;
    }
  };

  const start = (): void => {
    if (workerInterval !== undefined) return;
    let lastMemberId: string | undefined;
    workerInterval = setInterval(() => {
      const item = queue.shift();
      if (!item) {
        stop();
        return;
      }

      const { octokitRest, slackClient, member } = item;
      const memberId = member.slack?.id;

      const key = `${member.org.id}_${memberId}`;
      queueKeys.delete(key);

      if (key === lastMemberId) {
        // delay if retriggered
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        scheduleUpdateMember(octokitRest, slackClient, member);
        lastMemberId = undefined;
      } else {
        lastMemberId = key;
        updateMember(octokitRest, slackClient, member);
      }
    }, 10_000); // 7/min 60s 1min = 1 ttes les 8.5s max (with 9s we have rate limit errors)
  };

  const scheduleUpdateMember = (
    octokitRest: OctokitRestCompat,
    slackClient: WebClient,
    member: OrgMember,
  ): void => {
    const memberId = member.slack?.id;
    if (!memberId) return;

    const key = `${member.org.id}_${memberId}`;

    if (!queueKeys.has(key)) {
      queueKeys.add(key);
      queue.push({
        octokitRest,
        slackClient,
        member,
      });
      start();
    }
  };

  const scheduleUpdateOrg = async (
    octokitRest: OctokitRestCompat,
    org: Org,
  ): Promise<void> => {
    if (!org.slackTeamId || !org.slackToken) return;
    const [slackClient, cursor] = await Promise.all([
      org.slackToken
        ? new WebClient(org.slackToken)
        : mongoStores.slackTeams
            .findByKey(org.slackTeamId)
            .then((slackTeam) => {
              if (!slackTeam?.botAccessToken) return undefined;
              return new WebClient(slackTeam.botAccessToken);
            }),
      mongoStores.orgMembers.cursor(),
    ]);

    if (!slackClient) return;

    cursor.forEach((member) => {
      scheduleUpdateMember(octokitRest, slackClient, member);
    });
  };

  const scheduleUpdateAllOrgs = async (
    auth: (installationId: number) => Promise<OctokitRestCompat>,
  ): Promise<void> => {
    const cursor = await mongoStores.orgs.cursor();
    cursor.forEach(async (org) => {
      if (!(org.slackToken || org.slackTeamId) || !org.installationId) return;
      if (org.status !== "active") return;
      const github = await auth(org.installationId);
      await scheduleUpdateOrg(github, org);
    });
  };

  return {
    scheduleUpdateMember,
    scheduleUpdateOrg,
    scheduleUpdateAllOrgs,
    // exposed for testing
    updateMember,
  };
};
