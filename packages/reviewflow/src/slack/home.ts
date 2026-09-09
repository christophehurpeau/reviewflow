import type { KnownBlock } from "@slack/web-api";
import { WebClient } from "@slack/web-api";
import type { Probot } from "probot";
import type {
  MongoStores,
  Org,
  OrgMember,
  ReviewflowPr,
} from "reviewflow-core";
import { buildPrBucketQuery } from "reviewflow-core";
import type { PrBucket } from "reviewflow-modules";
import type { OctokitRestCompat } from "../octokit.ts";
import { orgSettingsUrl } from "../webappUrl.ts";
import {
  allocateRowBudget,
  buildBlocksForDataFromGithubAndMongo,
  buildBlocksForDataFromMongo,
  maxHomeBlocks,
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

    const findPrsInBucket = (bucket: PrBucket): Promise<ReviewflowPr[]> => {
      const { criteria, sort } = buildPrBucketQuery(bucket, {
        userId: member.user.id,
        accounts: [{ accountId: member.org.id, teams: member.teams }],
      });
      return mongoStores.prs.findAll(criteria, sort);
    };

    /* search limit: 30 requests per minute = 7 update/min max */
    const [
      prsWithRequestedReviewsFromGithub,
      prsWithRequestedReviewsFromMongo,
      prsWithReRequestedReviews,
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
      findPrsInBucket("requested-reviews"),
      //prsWithReRequestedReviews
      findPrsInBucket("re-requested-reviews"),
      //prsToMerge
      findPrsInBucket("ready-to-merge"),
      //prsWithRequestedChanges
      findPrsInBucket("changes-requested"),
      //prsInDraft
      findPrsInBucket("drafts"),
      //openedPrsWithNoActionPlanned
      findPrsInBucket("opened-missing-review-request"),
      //myOpenedPrsWaitingForRequestedReview
      findPrsInBucket("waiting-for-review"),
    ]);

    const requestedReviewsFromGithub =
      prsWithRequestedReviewsFromGithub?.data.items ?? [];
    const githubSearchFailed = !prsWithRequestedReviewsFromGithub;

    const hasPrsInProgress =
      prsInDraft.length > 0 ||
      openedPrsWithNoActionPlanned.length > 0 ||
      myOpenedPrsWaitingForRequestedReview.length > 0;

    const baseBlocks: KnownBlock[] = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Configure your ${process.env.REVIEWFLOW_NAME} settings ${createLink(
            orgSettingsUrl(member.org.login),
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

    // a github failure still spends a title, a divider and its error line
    const blocksOutsideSections =
      baseBlocks.length +
      (hasPrsInProgress ? 1 : 0) +
      (githubSearchFailed ? 3 : 0);

    const [
      reRequestedReviewsLimit,
      requestedReviewsLimit,
      readyToMergeLimit,
      changesRequestedLimit,
      missingReviewRequestLimit,
      draftsLimit,
      waitingForReviewLimit,
    ] = allocateRowBudget(
      [
        prsWithReRequestedReviews.length,
        requestedReviewsFromGithub.length,
        prsToMerge.length,
        prsWithRequestedChanges.length,
        openedPrsWithNoActionPlanned.length,
        prsInDraft.length,
        myOpenedPrsWaitingForRequestedReview.length,
      ],
      maxHomeBlocks - blocksOutsideSections,
    );

    let blocks: KnownBlock[] = [
      ...baseBlocks,
      // above the requested reviews: a review asked again is one the member has
      // already been through, so it comes before the ones they have not seen
      ...buildBlocksForDataFromMongo({
        userLogin: member.user.login,
        title: ":eyeglasses: Re-Requested reviews",
        results: prsWithReRequestedReviews,
        limit: reRequestedReviewsLimit,
        // the review is under way there, so there is nothing left to start
        rowOptions: { showReRequests: false, reviewRequestVerb: "requested" },
      }),
      ...buildBlocksForDataFromGithubAndMongo({
        userLogin: member.user.login,
        title: ":eyes: Requested reviews",
        response: prsWithRequestedReviewsFromGithub,
        mongoResults: prsWithRequestedReviewsFromMongo,
        limit: requestedReviewsLimit,
        rowOptions: { reviewRequestVerb: "requested", showStartReview: true },
        // reviewflow writes a document only once it has handled an event for
        // the pull request, never for an ignored repo, and prunes it after 12
        // months: the github search reaches those, mongo does not
        onUntrackedPr: (untrackedPr) => {
          log.error(
            {
              orgLogin: member.org.login,
              memberLogin: member.user.login,
              repoFullName: untrackedPr.repoFullName,
              prNumber: untrackedPr.number,
              prUrl: untrackedPr.url,
            },
            "Pull request requesting a review is not tracked by reviewflow",
          );
        },
      }),
      ...buildBlocksForDataFromMongo({
        userLogin: member.user.login,
        title: ":white_check_mark: Ready to merge",
        results: prsToMerge,
        limit: readyToMergeLimit,
        rowOptions: { reviewRequestVerb: "requested" },
      }),
      ...buildBlocksForDataFromMongo({
        userLogin: member.user.login,
        title: ":x: Changes requested",
        results: prsWithRequestedChanges,
        limit: changesRequestedLimit,
        rowOptions: { showPassedChecks: false, reviewRequestVerb: "requested" },
      }),
    ];

    if (hasPrsInProgress) {
      blocks = [
        ...blocks,
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "Your PRs in progress",
          },
        },
        ...buildBlocksForDataFromMongo({
          userLogin: member.user.login,
          title: ":warning: Missing request for review",
          results: openedPrsWithNoActionPlanned,
          limit: missingReviewRequestLimit,
        }),
        ...buildBlocksForDataFromMongo({
          userLogin: member.user.login,
          title: ":construction: Drafts",
          results: prsInDraft,
          limit: draftsLimit,
          rowOptions: { showDraft: false, showPassedChecks: false },
        }),
        ...buildBlocksForDataFromMongo({
          userLogin: member.user.login,
          title: ":clock1: Waiting for review",
          results: myOpenedPrsWaitingForRequestedReview,
          limit: waitingForReviewLimit,
        }),
      ];
    }

    // a github outage is worth reading even when nothing else is on the home
    if (blocks.length === baseBlocks.length) {
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

    if (blocks.length > maxHomeBlocks) {
      log.error(
        {
          memberLogin: member.user.login,
          orgLogin: member.org.login,
          blocksLength: blocks.length,
        },
        "Slack home exceeded the block limit, truncating",
      );
      blocks = blocks.slice(0, maxHomeBlocks);
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
            blocksLength: blocks.length,
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

  const createSlackClient = async (
    org: Org,
  ): Promise<WebClient | undefined> => {
    if (org.slackToken) return new WebClient(org.slackToken);
    if (!org.slackTeamId) return undefined;
    const slackTeam = await mongoStores.slackTeams.findByKey(org.slackTeamId);
    if (!slackTeam?.botAccessToken) return undefined;
    return new WebClient(slackTeam.botAccessToken);
  };

  const scheduleUpdateOrg = async (
    octokitRest: OctokitRestCompat,
    org: Org,
  ): Promise<void> => {
    const [slackClient, cursor] = await Promise.all([
      createSlackClient(org),
      // the slack client and the octokit are this org's, so a member of another
      // org scheduled here would be published through the wrong bot token
      mongoStores.orgMembers.cursor({ "org.id": org._id }),
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
