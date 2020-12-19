import type { Octokit } from '@octokit/core';
import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import type { MongoStores } from '../../../mongo';

export const syncTeams = async (
  mongoStores: MongoStores,
  github: Octokit,
  org: { login: string; id: number },
): Promise<void> => {
  const orgEmbed = { id: org.id, login: org.login };

  const teamIds: number[] = [];

  await Promise.all(
    await github.paginate(
      github.teams.list.endpoint.merge({
        org: org.login,
      }),
      ({ data }: RestEndpointMethodTypes['teams']['list']['response']) => {
        return Promise.all(
          data.map((team) => {
            teamIds.push(team.id);
            return mongoStores.orgTeams.upsertOne({
              _id: team.id,
              org: orgEmbed,
              name: team.name,
              slug: team.slug,
              description: team.description,
            });
          }),
        );
      },
    ),
  );

  await mongoStores.orgTeams.deleteMany({
    'org.id': org.id,
    _id: { $not: { $in: teamIds } },
  });
};
