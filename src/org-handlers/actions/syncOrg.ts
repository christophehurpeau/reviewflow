import { Octokit } from 'probot';
import { MongoStores, Org } from '../../mongo';

export const syncOrg = async (
  mongoStores: MongoStores,
  github: Octokit,
  org: { login: string; id: number },
): Promise<Org> => {
  const orgInStore = await mongoStores.orgs.upsertOne({
    _id: org.id as any, // TODO _id is number
    login: org.login,
  });

  const orgEmbed = { id: org.id, login: org.login };

  const memberIds: number[] = [];

  await github.paginate(
    github.orgs.listMembers.endpoint.merge({
      org: org.login,
    }),
    async (
      { data }: Octokit.Response<Octokit.OrgsListMembersResponse>,
      done,
    ) => {
      await Promise.all(
        data.map((member) => {
          memberIds.push(member.id);
          return Promise.all([
            mongoStores.orgMembers.upsertOne({
              _id: `${org.id}_${member.id}`,
              org: orgEmbed,
              user: {
                id: member.id,
                login: member.login,
              },
            }),
            mongoStores.users.upsertOne({
              _id: member.id as any,
              login: member.login,
              type: member.type,
            }),
          ]);
        }),
      );
      done();
    },
  );

  await mongoStores.orgMembers.deleteMany({
    'org.id': org.id,
    'user.id': { $not: { $in: memberIds } },
  });

  return orgInStore;
};
