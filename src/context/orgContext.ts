import { Context } from 'probot';
import { Config } from '../orgsConfigs';
import { initTeamSlack, TeamSlack } from './initTeamSlack';
import { getKeys } from './utils';

export interface OrgContext<
  GroupNames extends string = any,
  TeamNames extends string = any
> {
  config: Config<GroupNames, TeamNames>;
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
}
const ExcludesFalsy = (Boolean as any) as <T>(
  x: T | false | null | undefined,
) => x is T;

const initTeamContext = async (
  context: Context<any>,
  config: Config,
): Promise<OrgContext> => {
  const slackPromise = initTeamSlack(context, config);

  const githubLoginToGroup = new Map<string, string>();
  getKeys(config.groups).forEach((groupName) => {
    Object.keys(config.groups[groupName]).forEach((login) => {
      githubLoginToGroup.set(login, groupName);
    });
  });

  const githubLoginToTeams = new Map<string, string[]>();
  getKeys(config.teams || {}).forEach((acc, teamName) => {
    (config.teams as NonNullable<typeof config.teams>)[teamName].logins.forEach(
      (login) => {
        if (acc.has(login)) {
          acc.get(login).push(teamName);
        } else {
          acc.set(login, [teamName]);
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

  return {
    config,
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
  };
};

const orgContextsPromise = new Map();
const orgContexts = new Map();

export const obtainOrgContext = (
  context: Context<any>,
  config: Config,
): Promise<OrgContext> => {
  const owner = context.payload.repository.owner;

  const existingTeamContext = orgContexts.get(owner.login);
  if (existingTeamContext) return existingTeamContext;

  const existingPromise = orgContextsPromise.get(owner.login);
  if (existingPromise) return Promise.resolve(existingPromise);

  const promise = initTeamContext(context, config);
  orgContextsPromise.set(owner.login, promise);

  return promise.then((orgContext) => {
    orgContextsPromise.delete(owner.login);
    orgContexts.set(owner.login, orgContext);
    return orgContext;
  });
};
