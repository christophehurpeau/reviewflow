import type { MongoStores, OrgTeamEmbed } from "../../../mongo";
import type { CommonOctokitInterface } from "../../../octokit";
import { ExcludesFalsy } from "../../../utils/Excludes";

export const syncTeamMembers = async <T extends CommonOctokitInterface>(
  mongoStores: MongoStores,
  octokit: T,
  org: { login: string; id: number },
  team: OrgTeamEmbed,
): Promise<void> => {
  const memberIds: number[] = [];
  for await (const { data } of octokit.paginate.iterator(
    octokit.teams.listMembersInOrg,
    {
      org: org.login,
      team_slug: team.slug,
    },
  )) {
    const currentIterationMemberIds = data
      .filter(ExcludesFalsy)
      .map((member) => member.id);
    memberIds.push(...currentIterationMemberIds);

    await mongoStores.orgMembers.partialUpdateMany(
      {
        _id: {
          $in: currentIterationMemberIds.map(
            (memberId) => `${org.id}_${memberId}`,
          ),
        },
        "org.id": org.id,
        "teams.id": { $ne: team.id },
      },
      { $push: { teams: team } },
    );
  }

  await mongoStores.orgMembers.partialUpdateMany(
    {
      "org.id": org.id,
      "user.id": { $not: { $in: memberIds } },
    },
    { $pull: { teams: { id: team.id } } },
  );
};

export const syncTeamMembersWithTeamParents = async <
  T extends CommonOctokitInterface,
>(
  mongoStores: MongoStores,
  octokit: T,
  org: { login: string; id: number },
  team: OrgTeamEmbed,
): Promise<void> => {};
