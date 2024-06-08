import type { MongoStores, Org } from "../../../mongo";
import type { CommonOctokitInterface } from "../../../octokit";

interface OrgInfo {
  login: string;
  id: number;
}

export const syncOrg = async <T extends CommonOctokitInterface>(
  mongoStores: MongoStores,
  octokit: T,
  installationId: number | undefined,
  org: OrgInfo,
): Promise<Org> => {
  const orgInStore = await mongoStores.orgs.upsertOne({
    _id: org.id,
    login: org.login,
    installationId,
  });

  const orgEmbed = { id: org.id, login: org.login };

  const memberIds: number[] = [];

  for await (const { data } of octokit.paginate.iterator(
    octokit.orgs.listMembers,
    { org: org.login },
  )) {
    await Promise.all(
      data.map(async (member) => {
        if (!member) return;
        memberIds.push(member.id);
        return Promise.all([
          mongoStores.orgMembers.upsertOne<"teams">(
            {
              _id: `${org.id}_${member.id}`,
              org: orgEmbed,
              user: {
                id: member.id,
                login: member.login,
              },
            },
            {
              teams: [], // teams is synced in syncTeamMembers
            },
          ),
          mongoStores.users.upsertOne({
            _id: member.id,
            login: member.login,
            type: member.type,
          }),
        ]);
      }),
    );
  }

  await mongoStores.orgMembers.deleteMany({
    "org.id": org.id,
    "user.id": { $not: { $in: memberIds } },
  });

  return orgInStore;
};
