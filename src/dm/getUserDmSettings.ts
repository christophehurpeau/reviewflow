import type { MongoInsertType } from "liwi-mongo";
import { accountConfigs, defaultConfig } from "../accountConfigs/index.ts";
import type { MongoStores, UserDmSettings } from "../mongo.ts";
import { defaultDmSettings } from "./defaultDmSettings.ts";

const cache = new Map<string, Map<number, MongoInsertType<UserDmSettings>>>();

const getDefaultDmSettings = (org: string): UserDmSettings["settings"] => {
  const accountConfig = accountConfigs[org] || defaultConfig;
  return accountConfig.defaultDmSettings
    ? { ...defaultDmSettings, ...accountConfig.defaultDmSettings }
    : defaultDmSettings;
};

export const updateCache = (
  org: string,
  userId: number,
  userDmSettings: MongoInsertType<UserDmSettings>,
): MongoInsertType<UserDmSettings> => {
  const orgDefaultDmSettings = getDefaultDmSettings(org);

  // set defaults to make sure we always have all settings even after an update
  userDmSettings.settings = {
    ...orgDefaultDmSettings,
    ...userDmSettings.settings,
  };

  let orgCache = cache.get(org);
  if (!orgCache) {
    orgCache = new Map();
    cache.set(org, orgCache);
  }
  orgCache.set(userId, userDmSettings);

  return userDmSettings;
};

export const getUserDmSettings = async (
  mongoStores: MongoStores,
  org: string,
  orgId: number,
  userId: number,
): Promise<MongoInsertType<UserDmSettings>> => {
  const orgCache = cache.get(org);
  if (orgCache) {
    const userCache = orgCache.get(userId);
    if (userCache) return userCache;
  }

  const userDmSettingsConfig = await mongoStores.userDmSettings.findOne({
    orgId,
    userId,
  });

  if (userDmSettingsConfig) {
    return updateCache(org, userId, userDmSettingsConfig);
  }

  return updateCache(org, userId, {
    orgId,
    userId,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    settings: {} as UserDmSettings["settings"],
    silentTeams: [],
  });
};
