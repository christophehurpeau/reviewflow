import type { MongoStores, User } from '../../../mongo';
import type { CommonOctokitInterface } from '../../../octokit';

interface UserInfo {
  login: string;
  id: number;
}

export const syncUser = async <T extends CommonOctokitInterface>(
  mongoStores: MongoStores,
  github: T,
  installationId: number | undefined,
  userInfo: UserInfo,
): Promise<User> => {
  const user = await mongoStores.users.upsertOne({
    _id: userInfo.id,
    login: userInfo.login,
    type: 'User',
    installationId,
  });

  return user;
};
