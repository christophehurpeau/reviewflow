import Webhooks from '@octokit/webhooks';
import { WebClient, KnownBlock } from '@slack/web-api';
import { Context, Octokit } from 'probot';
import { MongoStores } from '../mongo';
import { getUserDmSettings } from '../dm/getUserDmSettings';
import { MessageCategory } from '../dm/MessageCategory';
import { Config } from '../orgsConfigs';
import { getKeys } from './utils';

interface SlackMessage {
  text: string;
  blocks?: KnownBlock[];
  secondaryBlocks?: KnownBlock[];
  ts?: string;
}

interface SlackMessageResult {
  ts: string;
}

export interface TeamSlack {
  mention: (githubLogin: string) => string;
  link: (url: string, text: string) => string;
  postMessage: (
    category: MessageCategory,
    githubId: number,
    githubLogin: string,
    message: SlackMessage,
  ) => Promise<SlackMessageResult | null>;
  prLink: <T extends { repository: Webhooks.PayloadRepository }>(
    pr: Octokit.PullsGetResponse,
    context: Context<T>,
  ) => string;
}

export const voidTeamSlack = (): TeamSlack => ({
  mention: (): string => '',
  link: (): string => '',
  postMessage: (): Promise<null> => Promise.resolve(null),
  prLink: (): string => '',
});

export const initTeamSlack = async <GroupNames extends string>(
  mongoStores: MongoStores,
  context: Context<any>,
  config: Config<GroupNames>,
  slackToken?: string,
): Promise<TeamSlack> => {
  const owner = context.payload.repository.owner;
  if (!slackToken) {
    return voidTeamSlack();
  }

  const githubLoginToSlackEmail = getKeys(config.groups).reduce<{
    [login: string]: string;
  }>((acc, groupName) => {
    Object.assign(acc, config.groups[groupName]);
    return acc;
  }, {});

  const slackEmails = Object.values(githubLoginToSlackEmail);
  const slackClient = new WebClient(slackToken);
  const members: [string, { member: any; im: any }][] = [];

  await slackClient.paginate('users.list', {}, (page: any) => {
    page.members.forEach((member: any) => {
      const email = member.profile && member.profile.email;
      if (email && slackEmails.includes(email)) {
        members.push([email, { member, im: undefined }]);
      }
    });
    return false;
  });

  for (const [, user] of members) {
    try {
      const im: any = await slackClient.im.open({ user: user.member.id });
      user.im = im.channel;
    } catch (err) {
      console.error(err);
    }
  }

  const membersMap = new Map(members);

  const getUserFromGithubLogin = (githubLogin: string) => {
    const email = githubLoginToSlackEmail[githubLogin];
    if (!email) return null;
    return membersMap.get(email);
  };

  return {
    mention: (githubLogin: string): string => {
      const user = getUserFromGithubLogin(githubLogin);
      if (!user) return githubLogin;
      return `<@${user.member.id}>`;
    },
    postMessage: async (
      category: MessageCategory,
      githubId: number,
      githubLogin: string,
      message: SlackMessage,
    ): Promise<null | SlackMessageResult> => {
      context.log.info('send slack', { githubLogin, message });
      if (process.env.DRY_RUN && process.env.DRY_RUN !== 'false') return null;

      const userDmSettings = await getUserDmSettings(
        mongoStores,
        owner.login,
        owner.id,
        githubId,
      );

      if (!userDmSettings[category]) return null;

      const user = getUserFromGithubLogin(githubLogin);
      if (!user || !user.im) return null;
      const result = await slackClient.chat.postMessage({
        username: process.env.REVIEWFLOW_NAME,
        channel: user.im.id,
        text: message.text,
        blocks: message.blocks,
        attachments: message.secondaryBlocks
          ? [{ blocks: message.secondaryBlocks }]
          : undefined,
        thread_ts: message.ts,
      });
      if (!result.ok) return null;
      return { ts: result.ts as string };
    },
    link: (url: string, text: string): string => {
      return `<${url}|${text}>`;
    },
    prLink: <T extends { repository: Webhooks.PayloadRepository }>(
      pr: Octokit.PullsGetResponse,
      context: Context<T>,
    ): string => {
      return `<${pr.html_url}|${context.payload.repository.name}#${pr.number}>`;
    },
  };
};
