import type {
  MongoStores,
  OrgTeamEmbed,
  UserDmSettings,
} from "reviewflow-core";
import type { MessageCategory } from "reviewflow-modules";

interface UserDmSettingsRef {
  orgId: number;
  userId: number;
}

const findOrCreate = async (
  mongoStores: MongoStores,
  { orgId, userId }: UserDmSettingsRef,
): Promise<UserDmSettings> => {
  const existing = await mongoStores.userDmSettings.findOne({ orgId, userId });
  if (existing) return existing;

  return mongoStores.userDmSettings.insertOne({
    _id: `${orgId}_${userId}`,
    orgId,
    userId,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    settings: {} as UserDmSettings["settings"],
    silentTeams: [],
  });
};

export const setDmSetting = async (
  mongoStores: MongoStores,
  ref: UserDmSettingsRef,
  key: MessageCategory,
  value: boolean,
): Promise<void> => {
  const userDmSettings = await findOrCreate(mongoStores, ref);
  await mongoStores.userDmSettings.partialUpdateOne(userDmSettings, {
    $set: { settings: { ...userDmSettings.settings, [key]: value } },
  });
};

export const setTeamSilenced = async (
  mongoStores: MongoStores,
  ref: UserDmSettingsRef,
  team: OrgTeamEmbed,
  silenced: boolean,
): Promise<void> => {
  const userDmSettings = await findOrCreate(mongoStores, ref);
  await mongoStores.userDmSettings.partialUpdateOne(
    userDmSettings,
    silenced
      ? { $push: { silentTeams: team } }
      : { $pull: { silentTeams: { id: team.id } } },
  );
};
