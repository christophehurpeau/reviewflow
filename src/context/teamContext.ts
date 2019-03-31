import { Context } from 'probot';
import { Config } from '../teamconfigs';
import { initTeamSlack, TeamSlack } from './initTeamSlack';
import { getKeys } from './utils';

export interface TeamContext<GroupNames extends string = any> {
  config: Config<GroupNames>;
  slack: TeamSlack;
  getReviewerGroup: (githubLogin: string) => string | undefined;
  getReviewerGroups: (githubLogins: string[]) => string[];
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
): Promise<TeamContext> => {
  const slackPromise = initTeamSlack(context, config);

  const githubLoginToGroup = getKeys(config.groups).reduce<Map<string, string>>(
    (acc, groupName) => {
      Object.values(config.groups[groupName]).forEach((login) => {
        acc.set(login, groupName);
      });
      return acc;
    },
    new Map(),
  );

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

const teamContextsPromise = new Map();
const teamContexts = new Map();

export const obtainTeamContext = (
  context: Context<any>,
  config: Config,
): Promise<TeamContext> => {
  const owner = context.payload.repository.owner;

  const existingTeamContext = teamContexts.get(owner.login);
  if (existingTeamContext) return existingTeamContext;

  const existingPromise = teamContextsPromise.get(owner.login);
  if (existingPromise) return Promise.resolve(existingPromise);

  const promise = initTeamContext(context, config);
  teamContextsPromise.set(owner.login, promise);

  return promise.then((teamContext) => {
    teamContextsPromise.delete(owner.login);
    teamContexts.set(owner.login, teamContext);
    return teamContext;
  });
};
