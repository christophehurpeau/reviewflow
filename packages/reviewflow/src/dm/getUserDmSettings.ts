import type { MongoInsertType } from "liwi-mongo";
import type { MongoStores, UserDmSettings } from "reviewflow-core";
import {
  accountConfigs,
  defaultConfig,
  defaultDmSettings,
} from "reviewflow-core";

interface CacheEntry {
  userDmSettings: MongoInsertType<UserDmSettings>;
  expiresAt: number;
}

/**
 * The webapp server writes these settings in another process, so an entry here
 * is only trusted for a short while: nothing tells this process that a user
 * changed a setting until the propagation described in
 * `plans/webapp-server-change-propagation.md` exists.
 */
const cacheDurationMs = 30_000;

const cache = new Map<string, Map<number, CacheEntry>>();

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
  orgCache.set(userId, {
    userDmSettings,
    expiresAt: Date.now() + cacheDurationMs,
  });

  return userDmSettings;
};

export const getUserDmSettings = async (
  mongoStores: MongoStores,
  org: string,
  orgId: number,
  userId: number,
): Promise<MongoInsertType<UserDmSettings>> => {
  const cacheEntry = cache.get(org)?.get(userId);
  if (cacheEntry && cacheEntry.expiresAt > Date.now()) {
    return cacheEntry.userDmSettings;
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
