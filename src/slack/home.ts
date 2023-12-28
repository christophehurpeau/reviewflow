import type { KnownBlock } from '@slack/web-api';
import { WebClient } from '@slack/web-api';
import type { MongoStores, Org, OrgMember, ReviewflowPr } from '../mongo';
import type { Octokit } from '../octokit';
import {
  createLink,
  createPrChangesInformationFromReviewflowPr,
} from './utils';

interface QueueItem {
  github: Octokit;
  slackClient: WebClient;
  member: OrgMember;
}

const buildPullRequestUrl = (reviewflowPullRequest: ReviewflowPr): string =>
  `https://github.com/${reviewflowPullRequest.account.login}/${reviewflowPullRequest.repo.name}/pull/${reviewflowPullRequest.pr.number}`;

export const createSlackHomeWorker = (mongoStores: MongoStores) => {
  const updateMember = async (
    octokit: Octokit,
    slackClient: WebClient,
    member: OrgMember,
  ): Promise<void> => {
    if (!member.slack?.id) return;

    /* search limit: 30 requests per minute = 7 update/min max */
    const [
      prsWithRequestedReviews,
      prsToMerge,
      prsWithRequestedChanges,
      prsInDraft,
    ] = await Promise.all([
      octokit.search
        .issuesAndPullRequests({
          q: `is:pr user:${member.org.login} is:open review-requested:${member.user.login} draft:false`,
          sort: 'created',
          order: 'desc',
        })
        .catch((error: unknown) => ({ error })),
      mongoStores.prs.findAll(
        {
          'account.id': member.org.id,
          'assignees.id': member.user.id,
          isClosed: false,
          'reviews.reviewRequested': { $exists: true, $eq: [] },
          'reviews.changesRequested': { $exists: true, $eq: [] },
          'reviews.approved': { $exists: true, $ne: [] },
        },
        { created: -1 },
      ),
      mongoStores.prs.findAll(
        {
          'account.id': member.org.id,
          'assignees.id': member.user.id,
          'reviews.changesRequested': { $exists: true, $ne: [] },
        },
        { created: -1 },
      ),
      octokit.search
        .issuesAndPullRequests({
          q: `is:pr user:${member.org.login} is:open assignee:${member.user.login} draft:true`,
          sort: 'created',
          order: 'desc',
          per_page: 5,
        })
        .catch((error: unknown) => ({ error })),
    ]);

    const blocks: any[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Configure your ${
            process.env.REVIEWFLOW_NAME
          } settings ${createLink(
            `${process.env.REVIEWFLOW_APP_URL}/org/${member.org.login}`,
            'here',
          )}.`,
        },
      },
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'PRs requesting your attention',
        },
      },
    ];

    const createTitleBlock = (title: string): KnownBlock => ({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${title}*`,
      },
    });
    const createDividerBlock = (): KnownBlock => ({ type: 'divider' });
    const createErrorBlock = (errorMessage: string): KnownBlock => ({
      type: 'section',
      text: {
        type: 'plain_text',
        text: errorMessage,
      },
    });
    const createPlaceholderImageBlock = (): KnownBlock => ({
      type: 'context',
      elements: [
        {
          type: 'image',
          image_url:
            'https://api.slack.com/img/blocks/bkb_template_images/placeholder.png',
          alt_text: 'placeholder',
        },
      ],
    });

    const buildBlocksForDataFromGithub = (
      title: string,
      response: typeof prsWithRequestedReviews,
    ) => {
      if (!response) {
        blocks.push(
          createTitleBlock(title),
          createDividerBlock(),
          createErrorBlock('No response from GitHub'),
        );
        return;
      }

      if ('error' in response) {
        blocks.push(
          createTitleBlock(title),
          createDividerBlock(),
          createErrorBlock('Error from GitHub'),
        );
        return;
      }

      const results = response.data;

      if (!results.total_count) return;

      blocks.push(
        createTitleBlock(title),
        createDividerBlock(),
        ...results.items.flatMap((pr) => {
          const repoName = pr.repository_url.slice(
            'https://api.github.com/repos/'.length,
          );
          const prFullName = `${repoName}#${pr.number}`;
          // const changesInformation =
          //   createPrChangesInformationFromPullRequestRest(pr);

          return [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*${createLink(pr.html_url, pr.title)}*`,
                //  ${pr.labels.map((l) => `{${l.name}}`).join(' · ')}
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `${createLink(pr.html_url, prFullName)} ${
                    pr.draft ? '· _Draft_' : ''
                  }`,
                },
                pr.user && {
                  type: 'image',
                  image_url: pr.user.avatar_url,
                  alt_text: pr.user.login,
                },
                pr.user && {
                  type: 'mrkdwn',
                  // eslint-disable-next-line @typescript-eslint/no-useless-template-literals -- making sure it's a string at runtime
                  text: `${pr.user.login}`,
                },
                // ...(changesInformation
                //   ? [{ type: 'mrkdwn', text: changesInformation }]
                //   : []),
              ].filter(Boolean),
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
        ...results.flatMap((pr) => {
          const repoName = pr.repo.name;
          const prFullName = `${repoName}#${pr.pr.number}`;
          const prUrl = buildPullRequestUrl(pr);
          const changesInformation =
            createPrChangesInformationFromReviewflowPr(pr);

          return [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*${createLink(prUrl, pr.title)}*`,
                //  ${pr.labels.map((l) => `{${l.name}}`).join(' · ')}
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `${createLink(prUrl, prFullName)} ${
                    pr.isDraft ? '· _Draft_' : ''
                  }`,
                },
                ...(pr.assignees && pr.assignees.length > 0
                  ? pr.assignees.flatMap((assignee) => [
                      {
                        type: 'image',
                        image_url: assignee.avatar_url,
                        alt_text: assignee.login,
                      },
                      {
                        type: 'mrkdwn',
                        // eslint-disable-next-line @typescript-eslint/no-useless-template-literals -- making sure it's a string at runtime
                        text: `${assignee.login}`,
                      },
                    ])
                  : [
                      pr.creator && {
                        type: 'image',
                        image_url: pr.creator.avatar_url,
                        alt_text: pr.creator.login,
                      },
                      pr.creator && {
                        type: 'mrkdwn',
                        // eslint-disable-next-line @typescript-eslint/no-useless-template-literals -- making sure it's a string at runtime
                        text: `${pr.creator.login}`,
                      },
                    ].filter(Boolean)),

                ...(changesInformation
                  ? [{ type: 'mrkdwn', text: changesInformation }]
                  : []),
              ],
            },
          ];
        }),
        createPlaceholderImageBlock(),
      );
    };

    buildBlocksForDataFromGithub(
      ':eyes: Requested reviews',
      prsWithRequestedReviews,
    );
    buildBlocksForDataFromMongo(
      ':white_check_mark: Ready to merge',
      prsToMerge,
    );
    buildBlocksForDataFromMongo(
      ':x: Changes requested',
      prsWithRequestedChanges,
    );
    buildBlocksForDataFromGithub(':construction: Drafts', prsInDraft);

    if (blocks.length === 2) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ":tada: It looks like you don't have any PR to review!",
        },
      });
    }

    slackClient.views.publish({
      user_id: member.slack.id,
      view: {
        type: 'home',
        blocks,
      },
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
