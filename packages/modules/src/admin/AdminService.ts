import type { ServiceQuery } from "liwi-resources-client";

export type AdminAccountType = "Organization" | "User";

/** an account reviewflow is installed on */
export interface AdminAccountSummary {
  _id: number;
  login: string;
  type: AdminAccountType;
  /** when the account was first synced: the install, as far as known */
  knownSince?: Date;
  paidEnabled: boolean;
}

export interface SetAccountPaidEnabledParams {
  accountId: number;
  accountType: AdminAccountType;
  enabled: boolean;
}

/** every query and operation is refused to anyone but the instance admins */
export interface AdminService {
  queries: {
    queryAdminOrgs: ServiceQuery<AdminAccountSummary[], Record<string, never>>;
    queryAdminUsers: ServiceQuery<AdminAccountSummary[], Record<string, never>>;
  };
  operations: {
    setAccountPaidEnabled: (
      params: SetAccountPaidEnabledParams,
    ) => Promise<void>;
  };
}
