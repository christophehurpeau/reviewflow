import type { ServiceQuery } from "liwi-resources-client";

export interface PersonalTokenSummary {
  _id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt?: Date;
  lastUsedIp?: string;
}

export interface CreatePersonalTokenParams {
  name: string;
}

export interface PersonalTokenIdParams {
  tokenId: string;
}

/** the only response carrying the token itself: it is never readable again */
export interface CreatedPersonalToken {
  _id: string;
  token: string;
}

export interface PersonalTokensService {
  queries: {
    queryMyPersonalTokens: ServiceQuery<
      PersonalTokenSummary[],
      Record<string, never>
    >;
  };
  operations: {
    createPersonalToken: (
      params: CreatePersonalTokenParams,
    ) => Promise<CreatedPersonalToken>;
    /** revokes the token and creates a new one under the same name */
    regeneratePersonalToken: (
      params: PersonalTokenIdParams,
    ) => Promise<CreatedPersonalToken>;
    revokePersonalToken: (params: PersonalTokenIdParams) => Promise<void>;
  };
}
