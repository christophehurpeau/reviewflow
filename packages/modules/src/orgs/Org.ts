import type { MessageCategory } from "../dm/MessageCategory.ts";

export interface OrgSummary {
  _id: number;
  login: string;
  status: "active" | "deleted" | "suspended";
}

export interface OrgTeamSummary {
  id: number;
  name: string;
  slug: string;
}

export type OrgSlackState = "app-not-installed" | "linked" | "user-not-linked";

export interface OrgSlackStatus {
  state: OrgSlackState;
  teamName?: string;
  teamId?: string;
  userId?: string;
  usesDeprecatedCustomApp: boolean;
}

/**
 * Subscribed on the org membership, so a team sync shows up without a reload.
 * Dm settings live in their own document and have their own query.
 */
export interface OrgSettings {
  _id: string;
  orgId: number;
  login: string;
  hasCustomAccountConfig: boolean;
  slack: OrgSlackStatus;
  /** team names resolved from the account config, not the github teams */
  configTeamNames: string[];
  githubTeams: OrgTeamSummary[];
  defaultDmSettings: Record<MessageCategory, boolean>;
}

export interface UserDmSettingsSummary {
  _id: string;
  settings: Partial<Record<MessageCategory, boolean>>;
  silentTeamIds: number[];
}
