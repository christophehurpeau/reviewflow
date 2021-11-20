import { WebClient } from '@slack/web-api';
import type { ProbotEvent } from 'events/probot-types';
import type { Config } from '../../accountConfigs';
import type { MessageCategory } from '../../dm/MessageCategory';
import { getUserDmSettings } from '../../dm/getUserDmSettings';
import type { Org, User, MongoStores } from '../../mongo';
import type { AppContext } from '../AppContext';
import type { AccountInfo } from '../getOrCreateAccount';
import { getKeys } from '../utils';
import type { SlackMessage } from './SlackMessage';
import type { TeamSlack, PostSlackMessageResult } from './TeamSlack';
import { voidTeamSlack } from './voidTeamSlack';

export type { TeamSlack } from './TeamSlack';

async function getSlackAccountFromAccount(
  mongoStores: MongoStores,
  account: Org | User,
): Promise<string | undefined> {
  // This is first for legacy org using their own slackToken and slack app. Keep using them.
  if ('slackToken' in account) return account.slackToken;
  if ('slackTeamId' in account) {
    const slackTeam = await mongoStores.slackTeams.findByKey(
      account.slackTeamId,
    );
    return slackTeam?.botAccessToken;
  }
  return undefined;
}

interface MemberObject {
  member: {
    id: string;
    teamId?: string;
  };
  slackClient?: WebClient;
  im: any;
}

export const initTeamSlack = async <GroupNames extends string>(
  { mongoStores, slackHome }: AppContext,
  context: ProbotEvent<any>,
  config: Config<GroupNames>,
  account: Org | User,
): Promise<TeamSlack> => {
  const slackToken = await getSlackAccountFromAccount(mongoStores, account);

  if (!slackToken) {
    return voidTeamSlack();
  }

  // eslint-disable-next-line unicorn/no-array-reduce, unicorn/prefer-object-from-entries -- this will be removed soon
  const githubLoginToSlackEmail = getKeys(config.groups).reduce<
    Record<string, string>
  >((acc, groupName) => {
    Object.assign(acc, config.groups[groupName]);
    return acc;
  }, {});

  const slackEmails = Object.values(githubLoginToSlackEmail);
  const orgSlackClient = new WebClient(slackToken);

  const membersInDb = await mongoStores.orgMembers.findAll({
    'org.id': account._id,
  });

  const members: [string, MemberObject][] = [];
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

    await orgSlackClient.paginate('users.list', {}, (page: any) => {
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
        member: { id: member.slack.id, teamId: member.slack.teamId },
        im: undefined,
      });
    }
  });

  const getSlackClient = (teamId?: string): WebClient | undefined => {
    if (
      !teamId ||
      !('slackTeamId' in account) ||
      !account.slackTeamId ||
      account.slackTeamId === teamId
    ) {
      return orgSlackClient;
    }

    if (!account.config.canUseExternalSlack) {
      return undefined;
    }

    // TODO support external slack
    return undefined;
  };

  const openConversation = async (
    slackClient: WebClient,
    userId: string,
  ): Promise<any> => {
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
    const slackClient = getSlackClient(user.member.teamId);
    if (slackClient) {
      user.slackClient = slackClient;
      const im = await openConversation(slackClient, user.member.id);
      if (im) user.im = im;
    }
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
      toUser: AccountInfo,
      message: SlackMessage,
    ): Promise<PostSlackMessageResult> => {
      context.log.debug(
        {
          category,
          toUser,
          message,
        },
        'slack: post message',
      );
      if (process.env.DRY_RUN && process.env.DRY_RUN !== 'false') return null;

      const userDmSettings = await getUserDmSettings(
        mongoStores,
        account.login,
        account._id,
        toUser.id,
      );

      if (!userDmSettings[category]) return null;

      const user = membersMap.get(toUser.login);
      if (!user || !user.slackClient || !user.im) return null;

      const result = await user.slackClient.chat.postMessage({
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
      return {
        ts: result.ts as string,
        channel: result.channel as string,
        user: toUser,
      };
    },
    updateMessage: async (
      toUser: AccountInfo,
      ts: string,
      channel: string,
      message: SlackMessage,
    ): Promise<PostSlackMessageResult> => {
      context.log.debug({ ts, channel, message }, 'slack: update message');
      if (process.env.DRY_RUN && process.env.DRY_RUN !== 'false') return null;

      const user = membersMap.get(toUser.login);
      if (!user || !user.slackClient || !user.im) return null;

      const result = await user.slackClient.chat.update({
        ts,
        channel,
        text: message.text,
        blocks: message.blocks,
        attachments: message.secondaryBlocks
          ? [{ blocks: message.secondaryBlocks }]
          : undefined,
      });
      if (!result.ok) return null;
      return {
        ts: result.ts as string,
        channel: result.channel as string,
        user: toUser,
      };
    },
    deleteMessage: async (
      toUser: AccountInfo,
      ts: string,
      channel: string,
    ): Promise<void> => {
      context.log.debug({ ts, channel }, 'slack: delete message');

      const user = membersMap.get(toUser.login);
      if (!user || !user.slackClient || !user.im) return;

      await user.slackClient.chat.delete({
        ts,
        channel,
      });
    },
    addReaction: async (
      toUser: AccountInfo,
      ts: string,
      channel: string,
      name: string,
    ): Promise<void> => {
      context.log.debug({ ts, channel, name }, 'slack: add reaction');

      const user = membersMap.get(toUser.login);
      if (!user || !user.slackClient || !user.im) return;

      await user.slackClient.reactions.add({
        timestamp: ts,
        channel,
        name,
      });
    },
    updateHome: (githubLogin: string): void => {
      context.log.debug({ githubLogin }, 'update slack home');

      const user = membersMap.get(githubLogin);
      if (!user || !user.slackClient || !user.member) return;

      slackHome.scheduleUpdateMember(context.octokit, user.slackClient, {
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

      const slackClient = getSlackClient(member.slack.teamId);
      if (slackClient) {
        const im = await openConversation(slackClient, member.slack.id);
        membersMap.set(userLogin, {
          member: { id: member.slack.id },
          slackClient,
          im,
        });
      }
    },
    shouldShowLoginMessage: (githubLogin: string) => {
      return !membersMap.has(githubLogin);
    },
  };
};
