import type { OctokitRestCompat } from "src/octokit";
import type { MongoStores, User } from "../../../mongo";

interface UserInfo {
  login: string;
  id: number;
}

export const syncUser = async (
  mongoStores: MongoStores,
  github: OctokitRestCompat,
  installationId: number | undefined,
  userInfo: UserInfo,
): Promise<User> => {
  const user = await mongoStores.users.upsertOne({
    _id: userInfo.id,
    login: userInfo.login,
    type: "User",
    installationId,
  });

  return user;
};
