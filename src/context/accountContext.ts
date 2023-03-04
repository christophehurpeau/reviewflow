import { Lock } from 'lock';
import type { Config } from '../accountConfigs';
import type { EventsWithOrganisation } from '../events/account-handlers/utils/createHandlerOrgChange';
import type { ProbotEvent } from '../events/probot-types';
import type {
  Org,
  User,
  AccountEmbed,
  AccountType,
  AccountEmbedWithoutType,
  OrgMember,
} from '../mongo';
import type { AppContext } from './AppContext';
import type { AccountInfo } from './getOrCreateAccount';
import { getOrCreateAccount } from './getOrCreateAccount';
import type { EventsWithRepository } from './repoContext';
import type { TeamSlack } from './slack/initTeamSlack';
import { initTeamSlack } from './slack/initTeamSlack';
import { getKeys } from './utils';

export interface AccountContext<TeamNames extends string = any> {
  config: Config<TeamNames>;
  accountEmbed: AccountEmbed;
  slack: TeamSlack;
  /** init slack after installation in webapp */
  initSlack: () => Promise<void>;
  getMembersForTeams: (teamIds: number[]) => Promise<AccountEmbedWithoutType[]>;
  getGithubTeamsForMember: (memberId: number) => Promise<OrgMember['teams']>;
  getTeamsForLogin: (githubLogin: string) => TeamNames[];
  updateGithubTeamMembers: () => Promise<void>;
  lock: (callback: () => Promise<void> | void) => Promise<void>;
}

export const getTeams = <TeamNames extends string>(
  config: Config<TeamNames>,
  member: OrgMember,
): TeamNames[] => {
  const { teams } = config;

  const teamNames = getKeys(teams).filter((teamName) => {
    const githubTeamName = teams[teamName].githubTeamName;
    if (!githubTeamName) {
      return false;
    }
    return member.teams.some((team) => team.name === githubTeamName);
  });

  return teamNames;
};

const initAccountContext = async <
  EventName extends EventsWithRepository | EventsWithOrganisation,
>(
  appContext: AppContext,
  context: ProbotEvent<EventName>,
  config: Config,
  accountInfo: AccountInfo,
): Promise<AccountContext> => {
  const account = await getOrCreateAccount(
    appContext,
    context.octokit,
    'installation' in context.payload
      ? context.payload.installation?.id
      : undefined,
    accountInfo,
  );
  const initSlack = (account: Org | User): ReturnType<typeof initTeamSlack> =>
    initTeamSlack(appContext, context, config, account);
  const slackPromise = initSlack(account);

  const githubLoginToTeams = new Map<string, string[]>();
  // TODO const githubLoginToSlackId = new Map<string, string>();

  const updateGithubTeamMembers = async (): Promise<void> => {
    if (accountInfo.type !== 'Organization') {
      return;
    }

    const members = await appContext.mongoStores.orgMembers.findAll({
      'org.id': accountInfo.id,
    });

    members.forEach((member) => {
      const teamNames = getTeams(config, member);
      githubLoginToTeams.set(member.user.login, teamNames);
    });
  };

  await updateGithubTeamMembers();

  const lock = Lock();

  return {
    config,
    accountEmbed: {
      id: accountInfo.id,
      login: accountInfo.login,
      type: accountInfo.type as AccountType,
    },
    lock: (callback: () => Promise<void> | void): Promise<void> => {
      return new Promise((resolve, reject) => {
        const logInfos = { account: accountInfo.login };
        context.log.info(logInfos, 'lock: try to lock account');
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        lock('_', async (createReleaseCallback) => {
          const release = createReleaseCallback(() => {});
          context.log.info(logInfos, 'lock: lock account acquired');
          try {
            await callback();
          } catch (err) {
            context.log.info(logInfos, 'lock: release account (with error)');
            release();
            reject(err);
            return;
          }
          context.log.info(logInfos, 'lock: release account');
          release();
          resolve();
        });
      });
    },

    getTeamsForLogin: (githubLogin): string[] =>
      githubLoginToTeams.get(githubLogin) || [],

    getMembersForTeams: async (teamIds): Promise<AccountEmbedWithoutType[]> => {
      if (teamIds.length === 0) return [];
      if (accountInfo.type !== 'Organization') {
        throw new Error(
          `Invalid account type "${accountInfo.type}" for getMembersForTeam`,
        );
      }
      const cursor = await appContext.mongoStores.orgMembers.cursor<
        Pick<OrgMember, 'user'>
      >({
        'org.id': account._id,
        'teams.id': { $in: teamIds },
      });
      await cursor.limit(100);
      const orgMembers = await cursor.toArray();
      return orgMembers.map((member) => member.user);
    },
    getGithubTeamsForMember: async (memberId): Promise<OrgMember['teams']> => {
      if (accountInfo.type !== 'Organization') {
        throw new Error(
          `Invalid account type "${accountInfo.type}" for getGithubTeamsForMember`,
        );
      }
      const orgMember = await appContext.mongoStores.orgMembers.findOne({
        'org.id': account._id,
        'user.id': memberId,
      });
      return orgMember ? orgMember.teams : [];
    },
    updateGithubTeamMembers,

    slack: await slackPromise,

    async initSlack(): Promise<void> {
      // get latest account
      const account = await getOrCreateAccount(
        appContext,
        context.octokit,
        context.payload.installation?.id,
        accountInfo,
      );
      const slack = await initSlack(account);
      (this as AccountContext).slack = slack;
    },
  };
};

const accountContextsPromise = new Map();
const accountContexts = new Map();

export const getExistingAccountContext = (
  accountInfo: AccountInfo,
): Promise<AccountContext> | null => {
  const existingAccountContext = accountContexts.get(accountInfo.login);
  if (existingAccountContext) return Promise.resolve(existingAccountContext);

  const existingPromise = accountContextsPromise.get(accountInfo.login);
  if (existingPromise) return Promise.resolve(existingPromise);

  return null;
};

export const obtainAccountContext = <
  EventName extends EventsWithRepository | EventsWithOrganisation,
>(
  appContext: AppContext,
  context: ProbotEvent<EventName>,
  config: Config,
  accountInfo: AccountInfo,
): Promise<AccountContext> => {
  const existingAccountContextPromise = getExistingAccountContext(accountInfo);
  if (existingAccountContextPromise) return existingAccountContextPromise;

  const promise = initAccountContext(appContext, context, config, accountInfo);
  accountContextsPromise.set(accountInfo.login, promise);

  return promise.then((accountContext) => {
    accountContextsPromise.delete(accountInfo.login);
    accountContexts.set(accountInfo.login, accountContext);
    return accountContext;
  });
};
