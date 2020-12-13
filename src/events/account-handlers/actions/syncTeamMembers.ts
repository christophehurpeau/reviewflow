import type { Octokit } from '@octokit/core';
import type { MongoStores } from '../../../mongo';

export const syncTeamMembers = async (
  mongoStores: MongoStores,
  github: Octokit,
  org: { login: string; id: number },
  team: { id: number },
): Promise<void> => {};
