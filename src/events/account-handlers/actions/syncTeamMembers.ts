import { Octokit } from 'probot';
import { MongoStores } from '../../../mongo';

export const syncTeamMembers = async (
  mongoStores: MongoStores,
  github: Octokit,
  org: { login: string; id: number },
  team: { id: number },
): Promise<void> => {};
