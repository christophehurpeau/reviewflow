import type { MongoStores, OrgTeamEmbed } from '../../../mongo';
import type { CommonOctokitInterface } from '../../../octokit';
import { syncTeamMembers } from './syncTeamMembers';

export const syncTeams = async <T extends CommonOctokitInterface>(
  mongoStores: MongoStores,
  octokit: T,
  org: { login: string; id: number },
): Promise<OrgTeamEmbed[]> => {
  const orgEmbed = { id: org.id, login: org.login };

  const teamEmbeds: OrgTeamEmbed[] = [];
  const teamIds: number[] = [];

  for await (const { data } of octokit.paginate.iterator(octokit.teams.list, {
    org: org.login,
  })) {
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
      'org.id': org.id,
      _id: { $not: { $in: teamIds } },
    }),

    mongoStores.orgMembers.partialUpdateMany(
      {
        'org.id': org.id,
      },
      { $pull: { teams: { id: { $not: { $in: teamIds } } } } },
    ),
  ]);

  return teamEmbeds;
};

export const syncTeamsAndTeamMembers = async <T extends CommonOctokitInterface>(
  mongoStores: MongoStores,
  octokit: T,
  org: { login: string; id: number },
): Promise<void> => {
  const teams = await syncTeams(mongoStores, octokit, org);
  for (const team of teams) {
    await syncTeamMembers(mongoStores, octokit, org, team);
  }
};
