import type { ServiceQuery } from "liwi-resources-client";

export interface RepositorySummary {
  _id: number;
  /** repository name without the owner, as used in the app routes */
  name: string;
  fullName: string;
  emoji: string;
  accountLogin: string;
  /** archived on github: kept, without its pull requests */
  archived: boolean;
}

export interface QueryAccountRepositoriesParams {
  accountId: number;
}

export interface QueryRepositoryParams {
  accountId: number;
  name: string;
}

export interface SyncRepositoryParams {
  accountId: number;
  repositoryId: number;
}

export interface RepositoriesService {
  queries: {
    queryAccountRepositories: ServiceQuery<
      RepositorySummary[],
      QueryAccountRepositoriesParams
    >;
    queryRepository: ServiceQuery<
      RepositorySummary | undefined,
      QueryRepositoryParams
    >;
  };
  operations: {
    syncRepository: (params: SyncRepositoryParams) => Promise<void>;
  };
}
