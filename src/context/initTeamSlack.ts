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

function getSlackAccountFromAccount(account: Org | User): string | undefined {
  // This is first for legacy org using their own slackToken and slack app. Keep using them.
  if ('slackToken' in account) return account.slackToken;
  if ('slack' in account) return account.slack?.accessToken;
  return undefined;
}

export const initTeamSlack = async <GroupNames extends string>(
  { mongoStores, slackHome }: AppContext,
  context: Context<any>,
  config: Config<GroupNames>,
  account: Org | User,
): Promise<TeamSlack> => {
  const slackToken = getSlackAccountFromAccount(account);

  if (!slackToken) {
    return voidTeamSlack();
  }

  const githubLoginToSlackEmail = getKeys(config.groups).reduce<
    Record<string, string>
  >((acc, groupName) => {
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
      members.push([login, { member: { id: member.slack.id }, im: undefined }]);
    }
  });

  if (foundEmailMembers.length !== slackEmails.length) {
    const missingEmails = slackEmails.filter(
      (email) => !foundEmailMembers.includes(email),
    );

    const memberEmailToGithubLogin = new Map<string, string>(
      Object.entries(githubLoginToSlackEmail).map(([login, email]) => [
        email,
        login,
      ]),
    );
    const memberEmailToMemberId = new Map<string, string>(
      Object.entries(githubLoginToSlackEmail).map(([login, email]) => [
        email,
        membersInDb.find((m) => m.user.login === login)?._id as any,
      ]),
    );

    await slackClient.paginate('users.list', {}, (page: any) => {
      page.members.forEach((member: any) => {
        const email = member.profile?.email;
        if (email && missingEmails.includes(email)) {
          const login = memberEmailToGithubLogin.get(email);
          if (!login) return;
          members.push([login, { member, im: undefined }]);
          const memberId = memberEmailToMemberId.get(email);
          if (memberId) {
            mongoStores.orgMembers.partialUpdateByKey(memberId, {
              $set: { slack: { id: member.id, email } },
            });
          }
        }
      });
      return false;
    });
  }

  const membersMap = new Map(members);

  // User added its email but not linked to a slack account yet
  // Temporary transition before login with slack in the settings
  membersInDb.forEach((member) => {
    if (member?.slack?.id && !membersMap.has(member.user.login)) {
      membersMap.set(member.user.login, {
        member: { id: member.slack.id },
        im: undefined,
      });
    }
  });

  const openConversation = async (userId: string): Promise<any> => {
    try {
      const im: any = await slackClient.conversations.open({
        users: userId,
      });
      return im.channel;
    } catch (err) {
      context.log('could create im', { err });
    }
  };

  for (const user of membersMap.values()) {
    const im = await openConversation(user.member.id);
    if (im) user.im = im;
  }

  return {
    mention: (githubLogin: string): string => {
      // TODO pass AccountInfo instead
      if (githubLogin.endsWith('[bot]')) {
        return `:robot_face: ${githubLogin.slice(0, -'[bot]'.length)}`;
      }
      const user = membersMap.get(githubLogin);
      if (!user) return githubLogin;
      return `<@${user.member.id}>`;
    },
    postMessage: async (
      category: MessageCategory,
      githubId: number,
      githubLogin: string,
      message: SlackMessage,
    ): Promise<PostSlackMessageResult> => {
      context.log.debug(
        {
          category,
          githubLogin,
          message,
        },
        'slack: post message',
      );
      if (process.env.DRY_RUN && process.env.DRY_RUN !== 'false') return null;

      const userDmSettings = await getUserDmSettings(
        mongoStores,
        account.login,
        account._id,
        githubId,
      );

      if (!userDmSettings[category]) return null;

      const user = membersMap.get(githubLogin);
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
      context.log.debug({ ts, channel, message }, 'slack: update message');
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
      context.log.debug({ ts, channel }, 'slack: delete message');
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
      context.log.debug({ ts, channel, name }, 'slack: add reaction');
      await slackClient.reactions.add({
        timestamp: ts,
        channel,
        name,
      });
    },
    updateHome: (githubLogin: string): void => {
      context.log.debug({ githubLogin }, 'update slack home');
      const user = membersMap.get(githubLogin);
      if (!user || !user.member) return;

      slackHome.scheduleUpdateMember(context.octokit, slackClient, {
        user: { id: null, login: githubLogin },
        org: { id: account._id, login: account.login },
        slack: { id: user.member.id },
      } as any);
    },

    updateSlackMember: async (userId, userLogin): Promise<void> => {
      // delete existing member if existing
      membersMap.delete(userLogin);

      const member = await mongoStores.orgMembers.findOne({
        'org.id': account._id,
        'user.id': userId,
      });

      if (!member || !member.slack) return;

      const im = await openConversation(member.slack.id);
      membersMap.set(userLogin, {
        member: { id: member.slack.id },
        im,
      });
    },
    shouldShowLoginMessage: (githubLogin: string) => {
      return !membersMap.has(githubLogin);
    },
  };
};
