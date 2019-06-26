import { WebClient } from '@slack/web-api';
import { Context } from 'probot';
import { Config } from '../orgsConfigs';
import { getKeys } from './utils';

export interface TeamSlack {
  mention: (githubLogin: string) => string;
  postMessage: (githubLogin: string, text: string) => Promise<void>;
}

const ExcludesFalsy = (Boolean as any) as <T>(
  x: T | false | null | undefined,
) => x is T;

export const initTeamSlack = async <GroupNames extends string>(
  context: Context<any>,
  config: Config<GroupNames>,
): Promise<TeamSlack> => {
  if (!config.slackToken) {
    return {
      mention: (githubLogin: string) => '',
      postMessage: (githubLogin: string, text: string) => Promise.resolve(),
    };
  }

  const githubLoginToSlackEmail = getKeys(config.groups).reduce<{
    [login: string]: string;
  }>((acc, groupName) => {
    Object.assign(acc, config.groups[groupName]);
    return acc;
  }, {});

  const slackClient = new WebClient(config.slackToken);
  const allUsers: any = await slackClient.users.list({ limit: 200 });
  const members: [string, { member: any; im: any }][] = Object.values(
    githubLoginToSlackEmail,
  )
    .map((email) => {
      const member = allUsers.members.find(
        (user: any) => user.profile.email === email,
      );
      if (!member) {
        console.warn(`Could not find user ${email}`);
        return;
      }
      return [email, { member, im: undefined }] as [
        string,
        { member: any; im: any }
      ];
    })
    .filter(ExcludesFalsy);

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
    mention: (githubLogin: string) => {
      const user = getUserFromGithubLogin(githubLogin);
      if (!user) return githubLogin;
      return `<@${user.member.id}>`;
    },
    postMessage: async (githubLogin: string, text: string) => {
      context.log.info('send slack', { githubLogin, text });
      if (process.env.DRY_RUN) return;

      const user = getUserFromGithubLogin(githubLogin);
      if (!user || !user.im) return;
      await slackClient.chat.postMessage({
        channel: user.im.id,
        text,
      });
    },
  };
};
