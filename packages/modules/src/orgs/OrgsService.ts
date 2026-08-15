import type { ServiceQuery } from "liwi-resources-client";
import type { MessageCategory } from "../dm/MessageCategory.ts";
import type { OrgSettings, OrgSummary, UserDmSettingsSummary } from "./Org.ts";

export interface QueryOrgSettingsParams {
  orgLogin: string;
}

export interface QueryMyDmSettingsParams {
  orgId: number;
}

export interface SetDmSettingParams {
  orgId: number;
  key: MessageCategory;
  value: boolean;
}

export interface SetTeamSilencedParams {
  orgId: number;
  teamId: number;
  silenced: boolean;
}

export interface ForceSyncOrgParams {
  orgId: number;
}

export interface OrgsService {
  queries: {
    queryMyOrgs: ServiceQuery<OrgSummary[], Record<string, never>>;
    queryOrgSettings: ServiceQuery<
      OrgSettings | undefined,
      QueryOrgSettingsParams
    >;
    queryMyDmSettings: ServiceQuery<
      UserDmSettingsSummary | undefined,
      QueryMyDmSettingsParams
    >;
  };
  operations: {
    setDmSetting: (params: SetDmSettingParams) => Promise<void>;
    setTeamSilenced: (params: SetTeamSilencedParams) => Promise<void>;
    forceSync: (params: ForceSyncOrgParams) => Promise<void>;
  };
}
