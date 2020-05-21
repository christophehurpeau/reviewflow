import { WebClient } from '@slack/web-api';
import { Octokit } from 'probot';
import { MongoStores, Org, OrgMember } from '../mongo';
import { createLink } from './utils';

export const updateMember = async (
  mongoStores: MongoStores,
  github: Octokit,
  slackClient: WebClient,
  member: OrgMember,
): Promise<void> => {
  if (!member.slack) return;

  const [
    prsWithRequestedReviews,
    prsToMerge,
    prsWithRequestedChanges,
  ] = await Promise.all([
    github.search.issuesAndPullRequests({
      q: `is:pr user:${member.org.login} is:open review-requested:${member.user.login} `,
      sort: 'created',
      order: 'desc',
    }),
    github.search.issuesAndPullRequests({
      q: `is:pr user:${member.org.login} is:open author:${member.user.login} label:":ok_hand: code/approved"`,
      sort: 'created',
      order: 'desc',
    }),
    github.search.issuesAndPullRequests({
      q: `is:pr user:${member.org.login} is:open author:${member.user.login} label:":ok_hand: code/changes-requested"`,
      sort: 'created',
      order: 'desc',
    }),
  ]);

  const blocks: any[] = [];

  const buildBlocks = (title: string, results: any) => {
    if (!results.total_count) return;

    blocks.push(
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${title}*`,
        },
      },
      {
        type: 'divider',
      },
      ...results.items.map((pr: any) => ({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${createLink(
            pr.html_url,
            `${pr.html_url.replace(/^.*\/([^/]+)\/pull\/\d+$/, '$1')}#${
              pr.number
            }`,
          )} ${pr.title}\nby ${pr.user.login}`,
        },
      })),
    );
  };

  buildBlocks('Requested Reviews', prsWithRequestedReviews.data);
  buildBlocks('Ready to Merge', prsToMerge.data);
  buildBlocks('Changes Requested', prsWithRequestedChanges.data);

  if (blocks.length === 0) {
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

export const updateOrg = async (
  mongoStores: MongoStores,
  github: Octokit,
  org: Org,
  slackClient = new WebClient(org.slackToken),
): Promise<void> => {
  const cursor = await mongoStores.orgMembers.cursor();
  cursor.forEach((member) => {
    updateMember(mongoStores, github, slackClient, member);
  });
};

export const updateAllOrgs = async (
  mongoStores: MongoStores,
  auth: (installationId: number) => Promise<Octokit>,
): Promise<void> => {
  const cursor = await mongoStores.orgs.cursor();
  cursor.forEach(async (org) => {
    if (!org.slackToken || !org.installationId) return;
    const github = await auth(org.installationId);
    await updateOrg(mongoStores, github, org);
  });
};
