import type { Config } from "./accountConfigs/types.ts";
import type { OrgMember } from "./mongo.ts";
import { getKeys } from "./utils.ts";

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
