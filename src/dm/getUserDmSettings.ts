import { MongoStores } from '../mongo';
import { orgsConfigs, defaultConfig } from '../orgsConfigs';
import { MessageCategory } from './MessageCategory';
import { defaultDmSettings } from './defaultDmSettings';

export type UserDmSettings = Record<MessageCategory, boolean>;
const cache = new Map<string, Map<number, UserDmSettings>>();

const getDefaultDmSettings = (org: string): UserDmSettings => {
  const orgConfig = orgsConfigs[org] || defaultConfig;
  return orgConfig.defaultDmSettings
    ? { ...defaultDmSettings, ...orgConfig.defaultDmSettings }
    : defaultDmSettings;
};

export const updateCache = (
  org: string,
  userId: number,
  newSettings: Partial<UserDmSettings>,
): void => {
  let orgCache = cache.get(org);
  if (!orgCache) {
    orgCache = new Map();
    cache.set(org, orgCache);
  }
  orgCache.set(userId, { ...getDefaultDmSettings(org), ...newSettings });
};

export const getUserDmSettings = async (
  mongoStores: MongoStores,
  org: string,
  orgId: number,
  userId: number,
): Promise<UserDmSettings> => {
  const orgDefaultDmSettings = getDefaultDmSettings(org);

  const userDmSettingsConfig = await mongoStores.userDmSettings.findOne({
    orgId,
    userId,
  });

  const config = userDmSettingsConfig
    ? {
        ...orgDefaultDmSettings,
        ...userDmSettingsConfig.settings,
      }
    : orgDefaultDmSettings;

  updateCache(org, userId, config);
  return config;
};
