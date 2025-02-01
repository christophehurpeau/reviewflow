import { WebClient } from "@slack/web-api";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- invalid used detection
import type { CodedError } from "@slack/web-api";
import type { Config } from "../../accountConfigs";
import type { MessageCategory } from "../../dm/MessageCategory";
import { getUserDmSettings } from "../../dm/getUserDmSettings";
import type { ProbotEvent } from "../../events/probot-types";
import type { MongoStores, Org, User } from "../../mongo";
import type { AppContext } from "../AppContext";
import type { AccountInfo } from "../getOrCreateAccount";
import type { SlackMessage } from "./SlackMessage";
import type { PostSlackMessageResult, TeamSlack } from "./TeamSlack";
import { voidTeamSlack } from "./voidTeamSlack";

export type { TeamSlack } from "./TeamSlack";

async function getSlackAccountFromAccount(
  mongoStores: MongoStores,
  account: Org | User,
): Promise<string | undefined> {
  // This is first for legacy org using their own slackToken and slack app. Keep using them.
  if ("slackToken" in account) return account.slackToken;
  if ("slackTeamId" in account && account.slackTeamId != null) {
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
    userGithubId: number;
    teamId?: string;
  };
  slackClient?: WebClient;
  im: any;
}

export const initTeamSlack = async <TeamNames extends string>(
  { mongoStores, slackHome }: AppContext,
  context: ProbotEvent<any>,
  config: Config<TeamNames>,
  account: Org | User,
): Promise<TeamSlack> => {
  const slackToken = await getSlackAccountFromAccount(mongoStores, account);

  if (!slackToken) {
    return voidTeamSlack();
  }

  const orgSlackClient = new WebClient(slackToken);

  const membersMap = new Map<string, MemberObject>();
  const membersInDb = await mongoStores.orgMembers.findAll({
    "org.id": account._id,
  });

  membersInDb.forEach((member) => {
    if (member.slack?.id && !membersMap.has(member.user.login)) {
      membersMap.set(member.user.login, {
        member: {
          id: member.slack.id,
          userGithubId: member.user.id,
          teamId: member.slack.teamId,
        },
        im: undefined,
      });
    }
  });

  const getSlackClient = (teamId?: string): WebClient | undefined => {
    if (
      !teamId ||
      !("slackTeamId" in account) ||
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
    } catch (error) {
      context.log.error(
        `Could not create im for ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
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
      if (githubLogin.endsWith("[bot]")) {
        return `:robot_face: ${githubLogin.slice(0, -"[bot]".length)}`;
      }
      const user = membersMap.get(githubLogin);
      if (!user) return githubLogin;
      return process.env.REVIEWFLOW_DEBUG
        ? `<@${user.member.id}> (${githubLogin})`
        : `<@${user.member.id}>`;
    },
    postMessage: async (
      category: MessageCategory,
      toUser: AccountInfo,
      message: SlackMessage,
      forTeamId?: number,
    ): Promise<PostSlackMessageResult> => {
      context.log.debug(
        {
          category,
          toUser,
          message,
        },
        "slack: post message",
      );
      if (process.env.DRY_RUN && process.env.DRY_RUN !== "false") return null;

      const userDmSettings = await getUserDmSettings(
        mongoStores,
        account.login,
        account._id,
        toUser.id,
      );

      if (!userDmSettings.settings[category]) return null;
      if (
        forTeamId &&
        userDmSettings.silentTeams?.some((team) => team.id === forTeamId)
      ) {
        return null;
      }

      const user = membersMap.get(toUser.login);
      if (!user?.slackClient || !user.im) return null;

      try {
        const result = await user.slackClient.chat.postMessage({
          username: process.env.REVIEWFLOW_NAME,
          channel: user.im.id,
          text: process.env.REVIEWFLOW_DEBUG
            ? `${message.text} (${category})`
            : message.text,
          blocks: message.blocks,
          attachments: message.secondaryBlocks
            ? [{ blocks: message.secondaryBlocks }]
            : undefined,
          thread_ts: message.threadTs,
          unfurl_links: false,
          unfurl_media: false,
        });
        if (!result.ok) return null;
        return {
          ts: result.ts!,
          channel: result.channel!,
          user: toUser,
        };
      } catch (error) {
        context.log.error(
          {
            error,
            category,
            toUser,
            message,
          },
          "slack: failed to post message",
        );
        return null;
      }
    },
    updateMessage: async (
      toUser: AccountInfo,
      ts: string,
      channel: string,
      message: SlackMessage,
    ): Promise<PostSlackMessageResult> => {
      context.log.debug({ ts, channel, message }, "slack: update message");
      if (process.env.DRY_RUN && process.env.DRY_RUN !== "false") return null;

      const user = membersMap.get(toUser.login);
      if (!user?.slackClient || !user.im) return null;

      try {
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
          ts: result.ts!,
          channel: result.channel!,
          user: toUser,
        };
      } catch (error) {
        context.log.error({ error }, "could not update message");
        return null;
      }
    },
    deleteMessage: async (
      toUser: AccountInfo,
      ts: string,
      channel: string,
    ): Promise<void> => {
      context.log.debug({ ts, channel }, "slack: delete message");

      const user = membersMap.get(toUser.login);
      if (!user?.slackClient || !user.im) return;

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
      context.log.debug({ ts, channel, name }, "slack: add reaction");

      const user = membersMap.get(toUser.login);
      if (!user?.slackClient || !user.im) return;

      try {
        await user.slackClient.reactions.add({
          timestamp: ts,
          channel,
          name,
        });
      } catch (error: CodedError | any) {
        if (error && error.code === "message_not_found") {
          return;
        }
        throw error;
      }
    },
    updateHome: (githubLogin: string): void => {
      context.log.debug({ githubLogin }, "update slack home");

      const user = membersMap.get(githubLogin);
      if (!user?.slackClient || !user.member) return;

      slackHome.scheduleUpdateMember(context.octokit, user.slackClient, {
        user: { id: user.member.userGithubId, login: githubLogin },
        org: { id: account._id, login: account.login },
        slack: { id: user.member.id },
      } as any);
    },

    updateSlackMember: async (userId, userLogin): Promise<void> => {
      // delete existing member if existing
      membersMap.delete(userLogin);

      const member = await mongoStores.orgMembers.findOne({
        "org.id": account._id,
        "user.id": userId,
      });

      if (!member?.slack) return;

      const slackClient = getSlackClient(member.slack.teamId);
      if (slackClient) {
        const im = await openConversation(slackClient, member.slack.id);
        membersMap.set(userLogin, {
          member: { id: member.slack.id, userGithubId: member.user.id },
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
