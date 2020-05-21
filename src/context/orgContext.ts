import { Context, Octokit } from 'probot';
import { Lock } from 'lock';
import { MongoStores, Org } from '../mongo';
import { Config } from '../orgsConfigs';
import { ExcludesFalsy } from '../utils/ExcludesFalsy';
import { syncOrg } from '../org-handlers/actions/syncOrg';
import { syncTeams } from '../org-handlers/actions/syncTeams';
import { initTeamSlack, TeamSlack } from './initTeamSlack';
import { getKeys } from './utils';

export interface OrgContext<
  GroupNames extends string = any,
  TeamNames extends string = any
> {
  config: Config<GroupNames, TeamNames>;
  org: Org;
  slack: TeamSlack;
  getReviewerGroup: (githubLogin: string) => string | undefined;
  getReviewerGroups: (githubLogins: string[]) => string[];
  getTeamsForLogin: (githubLogin: string) => TeamNames[];
  reviewShouldWait: (
    reviewerGroup: GroupNames | undefined,
    requestedReviewers: any[],
    {
      includesReviewerGroup,
      includesWaitForGroups,
    }: { includesReviewerGroup?: boolean; includesWaitForGroups?: boolean },
  ) => boolean;

  lock(callback: () => Promise<void> | void): Promise<void>;
}

const getOrCreateOrg = async (
  mongoStores: MongoStores,
  github: Octokit,
  orgInfo: { id: number; login: string },
): Promise<Org> => {
  let org = await mongoStores.orgs.findByKey(orgInfo.id);
  if (org) return org;
  org = await syncOrg(mongoStores, github, orgInfo);
  await syncTeams(mongoStores, github, orgInfo);
  return org;
};

const initTeamContext = async (
  mongoStores: MongoStores,
  context: Context<any>,
  config: Config,
  orgInfo: { id: number; login: string },
): Promise<OrgContext> => {
  const org = await getOrCreateOrg(mongoStores, context.github, orgInfo);
  const slackPromise = initTeamSlack(
    mongoStores,
    context,
    config,
    org.slackToken,
  );

  const githubLoginToGroup = new Map<string, string>();
  getKeys(config.groups).forEach((groupName) => {
    Object.keys(config.groups[groupName]).forEach((login) => {
      githubLoginToGroup.set(login, groupName);
    });
  });

  const githubLoginToTeams = new Map<string, string[]>();
  getKeys(config.teams || {}).forEach((teamName) => {
    (config.teams as NonNullable<typeof config.teams>)[teamName].logins.forEach(
      (login) => {
        const teams = githubLoginToTeams.get(login);
        if (teams) {
          teams.push(teamName);
        } else {
          githubLoginToTeams.set(login, [teamName]);
        }
      },
    );
  });

  const getReviewerGroups = (githubLogins: string[]) => [
    ...new Set(
      githubLogins
        .map((githubLogin) => githubLoginToGroup.get(githubLogin))
        .filter(Boolean),
    ),
  ];

  const lock = Lock();

  return {
    config,
    lock: (callback: () => Promise<void> | void): Promise<void> => {
      return new Promise((resolve, reject) => {
        const logInfos = { org: orgInfo.login };
        context.log.info('lock: try to lock org', logInfos);
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        lock('_', async (createReleaseCallback) => {
          const release = createReleaseCallback(() => {});
          context.log.info('lock: lock org acquired', logInfos);
          try {
            await callback();
          } catch (err) {
            context.log.info('lock: release org (with error)', logInfos);
            release();
            reject(err);
            return;
          }
          context.log.info('lock: release org', logInfos);
          release();
          resolve();
        });
      });
    },
    getReviewerGroup: (githubLogin) => githubLoginToGroup.get(githubLogin),
    getReviewerGroups: (githubLogins) => [
      ...new Set(
        githubLogins
          .map((githubLogin) => githubLoginToGroup.get(githubLogin))
          .filter(ExcludesFalsy),
      ),
    ],

    getTeamsForLogin: (githubLogin) =>
      githubLoginToTeams.get(githubLogin) || [],

    reviewShouldWait: (
      reviewerGroup,
      requestedReviewers,
      { includesReviewerGroup, includesWaitForGroups },
    ) => {
      if (!reviewerGroup) return false;

      const requestedReviewerGroups = getReviewerGroups(
        requestedReviewers.map((request) => request.login),
      );

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
    org,
  };
};

const orgContextsPromise = new Map();
const orgContexts = new Map();

export const obtainOrgContext = (
  mongoStores: MongoStores,
  context: Context<any>,
  config: Config,
  org: { id: number; login: string },
): Promise<OrgContext> => {
  const existingTeamContext = orgContexts.get(org.login);
  if (existingTeamContext) return existingTeamContext;

  const existingPromise = orgContextsPromise.get(org.login);
  if (existingPromise) return Promise.resolve(existingPromise);

  const promise = initTeamContext(mongoStores, context, config, org);
  orgContextsPromise.set(org.login, promise);

  return promise.then((orgContext) => {
    orgContextsPromise.delete(org.login);
    orgContexts.set(org.login, orgContext);
    return orgContext;
  });
};
