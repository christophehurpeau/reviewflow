import { Octokit } from 'probot';
import { MongoStores } from '../../mongo';

export const syncTeams = async (
  mongoStores: MongoStores,
  github: Octokit,
  org: { login: string; id: number },
): Promise<void> => {
  const orgEmbed = { id: org.id, login: org.login };

  const teamIds: number[] = [];

  await github.paginate(
    github.teams.list.endpoint.merge({
      org: org.login,
    }),
    async ({ data }: Octokit.Response<Octokit.TeamsListResponse>, done) => {
      await Promise.all(
        data.map((team) => {
          teamIds.push(team.id);
          return mongoStores.orgTeams.upsertOne({
            _id: team.id as any, // TODO _id number
            org: orgEmbed,
            name: team.name,
            slug: team.slug,
            description: team.description,
          });
        }),
      );
      done();
    },
  );

  await mongoStores.orgMembers.deleteMany({
    'org.id': org.id,
    'user.id': { $not: { $in: teamIds } },
  });
};
