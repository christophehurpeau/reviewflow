import type { MongoStores, OrgTeamEmbed } from "@reviewflow/core";
import type { OctokitPaginate, OctokitRestCompat } from "../../../octokit.ts";
import { syncTeamMembers } from "./syncTeamMembers.ts";

const staleTeamEmbed = (team: OrgTeamEmbed) => ({
  $elemMatch: {
    id: team.id,
    $or: [{ name: { $ne: team.name } }, { slug: { $ne: team.slug } }],
  },
});

const propagateTeamEmbed = async (
  mongoStores: MongoStores,
  orgId: number,
  team: OrgTeamEmbed,
): Promise<void> => {
  await Promise.all([
    mongoStores.orgMembers.partialUpdateMany(
      { "org.id": orgId, teams: staleTeamEmbed(team) },
      { $set: { "teams.$.name": team.name, "teams.$.slug": team.slug } },
      { touchUpdated: false },
    ),
    mongoStores.userDmSettings.partialUpdateMany(
      { orgId, silentTeams: staleTeamEmbed(team) },
      {
        $set: {
          "silentTeams.$.name": team.name,
          "silentTeams.$.slug": team.slug,
        },
      },
      { touchUpdated: false },
    ),
  ]);
};

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
        const teamEmbed: OrgTeamEmbed = {
          id: team.id,
          name: team.name,
          slug: team.slug,
        };
        teamIds.push(team.id);
        teamEmbeds.push(teamEmbed);
        await Promise.all([
          mongoStores.orgTeams.upsertOne({
            _id: team.id,
            org: orgEmbed,
            name: team.name,
            slug: team.slug,
            description: team.description,
          }),
          propagateTeamEmbed(mongoStores, org.id, teamEmbed),
        ]);
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
      { touchUpdated: false },
    ),

    mongoStores.userDmSettings.partialUpdateMany(
      { orgId: org.id },
      { $pull: { silentTeams: { id: { $not: { $in: teamIds } } } } },
      { touchUpdated: false },
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
