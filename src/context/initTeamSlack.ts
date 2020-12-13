import { WebClient } from '@slack/web-api';
import type { Context } from 'probot';
import type { Config } from '../accountConfigs';
import type { MessageCategory } from '../dm/MessageCategory';
import { getUserDmSettings } from '../dm/getUserDmSettings';
import type { Org, User } from '../mongo';
import type { AppContext } from './AppContext';
import type { SlackMessage } from './SlackMessage';
import type { TeamSlack, PostSlackMessageResult } from './TeamSlack';
import { getKeys } from './utils';
import { voidTeamSlack } from './voidTeamSlack';

export type { TeamSlack };

export const initTeamSlack = async <GroupNames extends string>(
  { mongoStores, slackHome }: AppContext,
  context: Context<any>,
  config: Config<GroupNames>,
  account: Org | User,
): Promise<TeamSlack> => {
  const owner = context.payload.repository.owner;
  const slackToken = 'slackToken' in account && account.slackToken;

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

  const membersInDb = await mongoStores.orgMembers.findAll({
    'org.id': account._id,
  });

  const members: [string, { member: any; im: any }][] = [];
  const foundEmailMembers: string[] = [];

  Object.entries(githubLoginToSlackEmail).forEach(([login, email]) => {
    const member = membersInDb.find((m) => m.user.login === login);
    if (member?.slack?.id) {
      foundEmailMembers.push(email);
      members.push([email, { member: { id: member.slack.id }, im: undefined }]);
    }
  });

  if (foundEmailMembers.length !== slackEmails.length) {
    const missingEmails = slackEmails.filter(
      (email) => !foundEmailMembers.includes(email),
    );

    const memberEmailToMemberId = new Map<string, number>(
      Object.entries(githubLoginToSlackEmail).map(([login, email]) => [
        email,
        membersInDb.find((m) => m.user.login === login)?._id as any,
      ]),
    );

    await slackClient.paginate('users.list', {}, (page: any) => {
      page.members.forEach((member: any) => {
        const email = member.profile?.email;
        if (email && missingEmails.includes(email)) {
          members.push([email, { member, im: undefined }]);
          if (memberEmailToMemberId.has(email)) {
            mongoStores.orgMembers.partialUpdateMany(
              {
                _id: memberEmailToMemberId.get(email),
              },
              { $set: { slack: { id: member.id } } },
            );
          }
        }
      });
      return false;
    });
  }

  for (const [, user] of members) {
    try {
      const im: any = await slackClient.conversations.open({
        users: user.member.id,
      });
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
    ): Promise<PostSlackMessageResult> => {
      context.log.debug('slack: post message', {
        category,
        githubLogin,
        message,
      });
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
      return { ts: result.ts as string, channel: result.channel as string };
    },
    updateMessage: async (
      ts: string,
      channel: string,
      message: SlackMessage,
    ): Promise<PostSlackMessageResult> => {
      context.log.debug('slack: update message', { ts, channel, message });
      if (process.env.DRY_RUN && process.env.DRY_RUN !== 'false') return null;

      const result = await slackClient.chat.update({
        ts,
        channel,
        text: message.text,
        blocks: message.blocks,
        attachments: message.secondaryBlocks
          ? [{ blocks: message.secondaryBlocks }]
          : undefined,
      });
      if (!result.ok) return null;
      return { ts: result.ts as string, channel: result.channel as string };
    },
    deleteMessage: async (ts: string, channel: string): Promise<void> => {
      context.log.debug('slack: delete message', { ts, channel });
      await slackClient.chat.delete({
        ts,
        channel,
      });
    },
    addReaction: async (
      ts: string,
      channel: string,
      name: string,
    ): Promise<void> => {
      context.log.debug('slack: add reaction', { ts, channel, name });
      await slackClient.reactions.add({
        timestamp: ts,
        channel,
        name,
      });
    },

    updateHome: (githubLogin: string): void => {
      context.log.debug('update slack home', { githubLogin });
      const user = getUserFromGithubLogin(githubLogin);
      if (!user || !user.member) return;

      slackHome.scheduleUpdateMember(context.github, slackClient, {
        user: { id: null, login: githubLogin },
        org: { id: account._id, login: account.login },
        slack: { id: user.member.id },
      } as any);
    },
  };
};
