import { Octokit } from 'probot';
import { MongoStores, Org } from '../../mongo';

interface OrgInfo {
  login: string;
  id: number;
}

export const syncOrg = async (
  mongoStores: MongoStores,
  github: Octokit,
  installationId: number,
  org: OrgInfo,
): Promise<Org> => {
  const orgInStore = await mongoStores.orgs.upsertOne({
    _id: org.id as any, // TODO _id is number
    login: org.login,
    installationId,
  });

  const orgEmbed = { id: org.id, login: org.login };

  const memberIds: number[] = [];

  await Promise.all(
    await github.paginate(
      github.orgs.listMembers.endpoint.merge({
        org: org.login,
      }),
      ({ data }: Octokit.Response<Octokit.OrgsListMembersResponse>) => {
        return Promise.all(
          data.map(async (member) => {
            memberIds.push(member.id);
            return Promise.all([
              (await mongoStores.orgMembers.collection).updateOne(
                { _id: `${org.id}_${member.id}` },
                {
                  $set: {
                    org: orgEmbed,
                    user: {
                      id: member.id,
                      login: member.login,
                    },
                  },
                  $setOnInsert: {
                    created: new Date(),
                  },
                },
              ),
              mongoStores.users.upsertOne({
                _id: member.id as any,
                login: member.login,
                type: member.type,
              }),
            ]);
          }),
        );
      },
    ),
  );

  await mongoStores.orgMembers.deleteMany({
    'org.id': org.id,
    'user.id': { $not: { $in: memberIds } },
  });

  return orgInStore;
};
