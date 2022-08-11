import { Lock } from 'lock';
import type { EventsWithOrganisation } from 'events/account-handlers/utils/createHandlerOrgChange';
import type {
  PullRequestWithDecentData,
  PullRequestWithDecentDataFromWebhook,
} from 'events/pr-handlers/utils/PullRequestData';
import type { ProbotEvent } from 'events/probot-types';
import type { Config } from '../accountConfigs';
import type {
  Org,
  User,
  AccountEmbed,
  AccountType,
  AccountEmbedWithoutType,
  OrgMember,
} from '../mongo';
import { ExcludesFalsy } from '../utils/Excludes';
import type { AppContext } from './AppContext';
import type { AccountInfo } from './getOrCreateAccount';
import { getOrCreateAccount } from './getOrCreateAccount';
import type { EventsWithRepository } from './repoContext';
import type { TeamSlack } from './slack/initTeamSlack';
import { initTeamSlack } from './slack/initTeamSlack';
import { getKeys } from './utils';

export interface AccountContext<
  GroupNames extends string = any,
  TeamNames extends string = any,
> {
  config: Config<GroupNames, TeamNames>;
  accountEmbed: AccountEmbed;
  slack: TeamSlack;
  /** init slack after installation in webapp */
  initSlack: () => Promise<void>;
  getReviewerGroup: (githubLogin: string) => GroupNames | undefined;
  getReviewerGroups: (githubLogins: string[]) => GroupNames[];
  getTeamGroup: (teamName: string) => GroupNames | undefined;
  getGithubTeamsGroups: (teamNames: string[]) => GroupNames[];
  getMembersForTeams: (teamIds: number[]) => Promise<AccountEmbedWithoutType[]>;
  getTeamsForLogin: (githubLogin: string) => TeamNames[];
  updateGithubTeamMembers: () => Promise<void>;
  approveShouldWait: (
    reviewerGroup: GroupNames | undefined,
    pullRequest: PullRequestWithDecentData,
    {
      includesReviewerGroup,
      includesWaitForGroups,
    }: { includesReviewerGroup?: boolean; includesWaitForGroups?: boolean },
  ) => boolean;

  lock: (callback: () => Promise<void> | void) => Promise<void>;
}

interface TeamsAndGroups {
  groupName?: string;
  teamNames: string[];
}

export const getTeamsAndGroups = (
  config: Config,
  member: OrgMember,
): TeamsAndGroups => {
  const { groupsGithubTeams, teams } = config;

  const groupName = !groupsGithubTeams
    ? undefined
    : (getKeys(groupsGithubTeams).find((groupName) => {
        return member.teams.some((team) => {
          return groupsGithubTeams[groupName].includes(team.name);
        });
      }) as string);

  const teamNames = getKeys(teams).filter((teamName) => {
    const githubTeamName = teams[teamName].githubTeamName;
    if (!githubTeamName) {
      return teams[teamName].logins.includes(member.user.login);
    }
    return member.teams.some((team) => team.name === githubTeamName);
  });
  return { groupName, teamNames };
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

  const githubLoginToGroup = new Map<string, string>();
  const githubTeamNameToGroup = new Map<string, string>();
  const githubLoginToTeams = new Map<string, string[]>();
  // TODO const githubLoginToSlackId = new Map<string, string>();

  for (const groupName of getKeys(config.groups)) {
    Object.keys(config.groups[groupName]).forEach((login) => {
      githubLoginToGroup.set(login, groupName);
    });
  }

  if (config.groupsGithubTeams) {
    for (const groupName of getKeys(config.groupsGithubTeams)) {
      config.groupsGithubTeams[groupName].forEach((teamName) => {
        githubTeamNameToGroup.set(teamName, groupName);
      });
    }
  }

  const updateGithubTeamMembers = async (): Promise<void> => {
    if (accountInfo.type !== 'Organization') {
      return;
    }

    const members = await appContext.mongoStores.orgMembers.findAll({
      'org.id': accountInfo.id,
    });

    members.forEach((member) => {
      const { groupName, teamNames } = getTeamsAndGroups(config, member);
      if (groupName) {
        githubLoginToGroup.set(member.user.login, groupName);
      }
      githubLoginToTeams.set(member.user.login, teamNames);
    });
  };

  await updateGithubTeamMembers();

  const getReviewerGroups = (githubLogins: string[]): string[] => [
    ...new Set(
      githubLogins
        .map((githubLogin) => githubLoginToGroup.get(githubLogin))
        .filter(ExcludesFalsy),
    ),
  ];
  const getGithubTeamsGroups = (githubTeamNames: string[]): string[] => [
    ...new Set(
      githubTeamNames
        .map((teamName) => githubTeamNameToGroup.get(teamName))
        .filter(ExcludesFalsy),
    ),
  ];

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
    getReviewerGroup: (githubLogin): string | undefined =>
      githubLoginToGroup.get(githubLogin),
    getReviewerGroups,
    getTeamGroup: (githubTeamName): string | undefined =>
      githubTeamNameToGroup.get(githubTeamName),
    getGithubTeamsGroups,

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
    updateGithubTeamMembers,

    approveShouldWait: (
      reviewerGroup,
      pullRequest,
      { includesReviewerGroup, includesWaitForGroups },
    ): boolean => {
      if (
        !reviewerGroup ||
        !pullRequest.requested_reviewers ||
        !pullRequest.requested_teams
      ) {
        return false;
      }

      const requestedReviewerGroups = [
        ...new Set([
          ...getReviewerGroups(
            (
              pullRequest.requested_reviewers as PullRequestWithDecentDataFromWebhook['requested_reviewers']
            )
              .map((request) => {
                if (!request) return undefined;
                return 'name' in request ? request.name : request.login;
              })
              .filter(ExcludesFalsy),
          ),
          ...(!pullRequest.requested_teams
            ? []
            : getGithubTeamsGroups(
                (
                  pullRequest.requested_teams as PullRequestWithDecentDataFromWebhook['requested_teams']
                ).map((team) => team.name),
              )),
        ]),
      ];

      // contains another request of a reviewer in the same group
      if (
        includesReviewerGroup &&
        requestedReviewerGroups.includes(reviewerGroup)
      ) {
        return true;
      }

      // contains a request from a dependent group
      if (config.waitForGroups && includesWaitForGroups) {
        const waitForGroups = config.waitForGroups;
        return requestedReviewerGroups.some((group) =>
          waitForGroups[reviewerGroup].includes(group),
        );
      }

      return false;
    },

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
