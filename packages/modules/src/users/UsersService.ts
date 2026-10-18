import type { ServiceQuery } from "liwi-resources-client";
import type { SessionUser } from "../auth/AuthenticatedUser.ts";

export interface UserSummary {
  _id: number;
  login: string;
  installed: boolean;
  paidEnabled: boolean;
}

export interface UsersService {
  queries: {
    queryMe: ServiceQuery<UserSummary | undefined, Record<string, never>>;
  };
  operations: {
    getAuthenticatedUser: () => Promise<SessionUser>;
    forceSync: () => Promise<void>;
  };
}
