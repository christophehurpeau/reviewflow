import type { MongoStores, OrgTeamEmbed } from "../../../mongo.ts";
import type { OctokitPaginate, OctokitRestCompat } from "../../../octokit.ts";
import { syncTeamMembers } from "./syncTeamMembers.ts";

export const syncTeams = async (
  mongoStores: MongoStores,
  octokitRest: OctokitRestCompat,
  octokitPaginate: OctokitPaginate,
  org: { login: string; id: number },
): Promise<OrgTeamEmbed[]> => {
  const orgEmbed = { id: org.id, login: org.login };

  const teamEmbeds: OrgTeamEmbed[] = [];
  const teamIds: number[] = [];

  for await (const { data } of octokitPaginate.iterator(
    octokitRest.teams.list,
    {
      org: org.login,
    },
  )) {
    await Promise.all(
      data.map(async (team) => {
        teamIds.push(team.id);
        teamEmbeds.push({
          id: team.id,
          name: team.name,
          slug: team.slug,
        });
        return mongoStores.orgTeams.upsertOne({
          _id: team.id,
          org: orgEmbed,
          name: team.name,
          slug: team.slug,
          description: team.description,
        });
      }),
    );
  }

  await Promise.all([
    mongoStores.orgTeams.deleteMany({
      "org.id": org.id,
      _id: { $not: { $in: teamIds } },
    }),

    mongoStores.orgMembers.partialUpdateMany(
      {
        "org.id": org.id,
      },
      { $pull: { teams: { id: { $not: { $in: teamIds } } } } },
    ),
  ]);

  return teamEmbeds;
};

export const syncTeamsAndTeamMembers = async (
  mongoStores: MongoStores,
  octokitRest: OctokitRestCompat,
  octokitPaginate: OctokitPaginate,
  org: { login: string; id: number },
): Promise<void> => {
  const teams = await syncTeams(mongoStores, octokitRest, octokitPaginate, org);
  for (const team of teams) {
    await syncTeamMembers(mongoStores, octokitRest, octokitPaginate, org, team);
  }
};
