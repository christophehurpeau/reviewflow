import type { ServiceQuery } from "liwi-resources-client";
import type { AuthenticatedUser } from "../auth/AuthenticatedUser.ts";

export interface UserSummary {
  _id: number;
  login: string;
  installed: boolean;
}

export interface UsersService {
  queries: {
    queryMe: ServiceQuery<UserSummary | undefined, Record<string, never>>;
  };
  operations: {
    getAuthenticatedUser: () => Promise<AuthenticatedUser>;
    forceSync: () => Promise<void>;
  };
}
