import type { ServiceQuery } from "liwi-resources-client";

export interface RepositorySummary {
  _id: number;
  /** repository name without the owner, as used in the app routes */
  name: string;
  fullName: string;
  emoji: string;
  orgLogin: string;
}

export interface QueryOrgRepositoriesParams {
  orgId: number;
}

export interface QueryRepositoryParams {
  orgId: number;
  name: string;
}

export interface RepositoriesService {
  queries: {
    queryOrgRepositories: ServiceQuery<
      RepositorySummary[],
      QueryOrgRepositoriesParams
    >;
    queryRepository: ServiceQuery<
      RepositorySummary | undefined,
      QueryRepositoryParams
    >;
  };
  operations: Record<string, never>;
}
