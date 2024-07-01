import type { KnownBlock } from "@slack/web-api";
import { WebClient } from "@slack/web-api";
import type { Probot } from "probot";
import type { MongoStores, Org, OrgMember, ReviewflowPr } from "../mongo";
import type { Octokit } from "../octokit";
import { ExcludesFalsy } from "../utils/Excludes";
import {
  createLink,
  createPrChangesInformationFromReviewflowPr,
} from "./utils";

interface QueueItem {
  github: Octokit;
  slackClient: WebClient;
  member: OrgMember;
}

const buildPullRequestUrl = (reviewflowPullRequest: ReviewflowPr): string =>
  `https://github.com/${reviewflowPullRequest.account.login}/${reviewflowPullRequest.repo.name}/pull/${reviewflowPullRequest.pr.number}`;

export const createSlackHomeWorker = (
  mongoStores: MongoStores,
  log: Probot["log"],
) => {
  const updateMember = async (
    octokit: Octokit,
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
      octokit.search
        .issuesAndPullRequests({
          q: `is:pr user:${member.org.login} is:open review-requested:${member.user.login} draft:false`,
          sort: "created",
          order: "desc",
        })
        .catch((error: unknown) => {
          log.error("Error searching PRs", { error });
        }),
      //prsWithRequestedReviewsFromMongo
      mongoStores.prs.findAll(
        {
          "account.id": member.org.id,
          isClosed: false,
          isDraft: false,
          "reviews.reviewRequested.id": member.user.id,
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

    const blocks: any[] = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Configure your ${
            process.env.REVIEWFLOW_NAME
          } settings ${createLink(
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

    const createTitleBlock = (title: string): KnownBlock => ({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${title}*`,
      },
    });
    const createDividerBlock = (): KnownBlock => ({ type: "divider" });
    const createErrorBlock = (errorMessage: string): KnownBlock => ({
      type: "section",
      text: {
        type: "plain_text",
        text: errorMessage,
      },
    });
    const createPlaceholderImageBlock = (): KnownBlock => ({
      type: "context",
      elements: [
        {
          type: "image",
          image_url:
            "https://api.slack.com/img/blocks/bkb_template_images/placeholder.png",
          alt_text: "placeholder",
        },
      ],
    });

    const createBlocksForDataFromMongoPr = (
      pr: (typeof prsToMerge)[number],
    ): KnownBlock[] => {
      const repoName = pr.repo.name;
      const prFullName = `${repoName}#${pr.pr.number}`;
      const prUrl = buildPullRequestUrl(pr);
      const changesInformation = createPrChangesInformationFromReviewflowPr(pr);

      return [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${createLink(prUrl, prFullName)}${
              pr.isDraft ? " · _Draft_" : ""
            } · *${createLink(prUrl, pr.title)}*`,
          },
        },
        {
          type: "context",
          elements: [
            ...(() => {
              if (pr.assignees && pr.assignees.length > 0) {
                return pr.assignees.flatMap(
                  (assignee) =>
                    [
                      {
                        type: "image",
                        image_url: assignee.avatar_url,
                        alt_text: assignee.login,
                      },
                      {
                        type: "mrkdwn",
                        text: assignee.login,
                      },
                    ] as const,
                );
              }
              if (pr.creator) {
                return [
                  {
                    type: "image",
                    image_url: pr.creator.avatar_url,
                    alt_text: pr.creator.login,
                  },
                  {
                    type: "mrkdwn",
                    text: pr.creator.login,
                  },
                ] as const;
              }
              return [];
            })(),

            ...(changesInformation
              ? ([
                  {
                    type: "mrkdwn",
                    text: createLink(`${prUrl}/files`, changesInformation),
                  },
                ] as const)
              : []),

            ...(pr.flowDates?.approvedAt || pr.flowDates?.openedAt
              ? ([
                  {
                    type: "mrkdwn",
                    text: `${
                      pr.flowDates.approvedAt ? "Approved" : "Opened"
                    } ${(
                      pr.flowDates.approvedAt || pr.flowDates.openedAt
                    ).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "numeric",
                    })}`,
                  },
                ] as const)
              : []),
          ],
        },
      ] as const;
    };

    const buildBlocksForDataFromGithubAndMongo = (
      title: string,
      response: typeof prsWithRequestedReviewsFromGithub,
      mongoResponse: typeof prsWithRequestedReviewsFromMongo,
    ) => {
      if (!response) {
        blocks.push(
          createTitleBlock(title),
          createDividerBlock(),
          createErrorBlock("No response from GitHub"),
        );
        return;
      }

      if ("error" in response) {
        blocks.push(
          createTitleBlock(title),
          createDividerBlock(),
          createErrorBlock("Error from GitHub"),
        );
        return;
      }

      const results = response.data;

      if (!results.total_count) return;

      blocks.push(
        createTitleBlock(title),
        createDividerBlock(),
        ...results.items.flatMap((prFromGithub): KnownBlock[] => {
          const prFromMongo = mongoResponse.find(
            (prfm) =>
              // does not work as pr from github id is not the pr id, curiously prFromGithub.id === prfm.pr.id,
              prFromGithub.number === prfm.pr.number &&
              prFromGithub.repository_url ===
                `https://api.github.com/repos/${prfm.account.login}/${prfm.repo.name}`,
          );

          if (prFromMongo) {
            return createBlocksForDataFromMongoPr(prFromMongo);
          }
          const repoName = prFromGithub.repository_url.slice(
            "https://api.github.com/repos/".length,
          );
          const prFullName = `${repoName}#${prFromGithub.number}`;

          return [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `${createLink(prFromGithub.html_url, prFullName)} ${
                  prFromGithub.draft ? "· _Draft_" : ""
                } · *${createLink(prFromGithub.html_url, prFromGithub.title)}*`,
              },
            },
            {
              type: "context",
              elements: [
                prFromGithub.user &&
                  ({
                    type: "image",
                    image_url: prFromGithub.user.avatar_url,
                    alt_text: prFromGithub.user.login,
                  } as const),
                prFromGithub.user &&
                  ({
                    type: "mrkdwn",
                    text: prFromGithub.user.login,
                  } as const),
              ].filter(ExcludesFalsy),
            },
          ];
        }),
        createPlaceholderImageBlock(),
      );
    };

    const buildBlocksForDataFromMongo = (
      title: string,
      results: typeof prsToMerge,
    ) => {
      if (results.length === 0) return;

      blocks.push(
        createTitleBlock(title),
        createDividerBlock(),
        ...results.flatMap((pr) => createBlocksForDataFromMongoPr(pr)),
        createPlaceholderImageBlock(),
      );
    };

    buildBlocksForDataFromGithubAndMongo(
      ":eyes: Requested reviews",
      prsWithRequestedReviewsFromGithub,
      prsWithRequestedReviewsFromMongo,
    );
    buildBlocksForDataFromMongo(
      ":white_check_mark: Ready to merge",
      prsToMerge,
    );
    buildBlocksForDataFromMongo(
      ":x: Changes requested",
      prsWithRequestedChanges,
    );

    if (prsInDraft.length > 0) {
      blocks.push({
        type: "header",
        text: {
          type: "plain_text",
          text: "Your PRs in progress",
        },
      });
      buildBlocksForDataFromMongo(":construction: Your drafts PRs", prsInDraft);
    }

    if (openedPrsWithNoActionPlanned.length > 0) {
      buildBlocksForDataFromMongo(
        ":warning: Your opened PRs missing a request for review",
        openedPrsWithNoActionPlanned,
      );
    }
    if (myOpenedPrsWaitingForRequestedReview.length > 0) {
      buildBlocksForDataFromMongo(
        ":clock1: Your opened PRs waiting for a review",
        myOpenedPrsWaitingForRequestedReview,
      );
    }

    if (blocks.length === 2) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":tada: It looks like you don't have any PR to review!",
        },
      });
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
        log.error("Error updating home", {
          error,
          memberLogin: member.user.login,
          orgLogin: member.org.login,
          blocks,
        });
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
    workerInterval = setInterval(() => {
      const item = queue.shift();
      if (!item) {
        stop();
        return;
      }

      const { github, slackClient, member } = item;
      const memberId = member.slack?.id;

      const key = `${member.org.id}_${memberId}`;
      queueKeys.delete(key);

      updateMember(github, slackClient, member);
    }, 10_000); // 7/min 60s 1min = 1 ttes les 8.5s max (with 9s we have rate limit errors)
  };

  const scheduleUpdateMember = (
    github: Octokit,
    slackClient: WebClient,
    member: OrgMember,
  ): void => {
    const memberId = member.slack?.id;
    if (!memberId) return;

    const key = `${member.org.id}_${memberId}`;

    if (!queueKeys.has(key)) {
      queueKeys.add(key);
      queue.push({
        github,
        slackClient,
        member,
      });
      start();
    }
  };

  const scheduleUpdateOrg = async (
    github: Octokit,
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
      scheduleUpdateMember(github, slackClient, member);
    });
  };

  const scheduleUpdateAllOrgs = async (
    auth: (installationId: number) => Promise<Octokit>,
  ): Promise<void> => {
    const cursor = await mongoStores.orgs.cursor();
    cursor.forEach(async (org) => {
      if (!(org.slackToken || org.slackTeamId) || !org.installationId) return;
      const github = await auth(org.installationId);
      await scheduleUpdateOrg(github, org);
    });
  };

  return {
    scheduleUpdateMember,
    scheduleUpdateOrg,
    scheduleUpdateAllOrgs,
  };
};
