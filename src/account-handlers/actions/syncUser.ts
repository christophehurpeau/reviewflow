import { Octokit } from 'probot';
import { MongoStores, User } from '../../mongo';

interface UserInfo {
  login: string;
  id: number;
}

export const syncUser = async (
  mongoStores: MongoStores,
  github: Octokit,
  installationId: number,
  userInfo: UserInfo,
): Promise<User> => {
  const user = await mongoStores.users.upsertOne({
    _id: userInfo.id as any, // TODO _id is number
    login: userInfo.login,
    installationId,
  });

  return user;
};
