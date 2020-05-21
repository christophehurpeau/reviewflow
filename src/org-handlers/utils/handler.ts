import { Context } from 'probot';
import { orgsConfigs, defaultConfig } from '../../orgsConfigs';
import { MongoStores } from '../../mongo';
import { OrgContext, obtainOrgContext } from '../../context/orgContext';

type CallbackContextAndOrgContext<T> = (
  context: Context<T>,
  orgContext: OrgContext,
) => void | Promise<void>;

export const handlerOrgChange = async <
  T extends { organization: { id: number; login: string } }
>(
  mongoStores: MongoStores,
  context: Context<T>,
  callback: CallbackContextAndOrgContext<T>,
): Promise<void> => {
  const org = context.payload.organization;
  const config = orgsConfigs[org.login] || defaultConfig;
  const orgContext = await obtainOrgContext(mongoStores, context, config, org);
  if (!orgContext) return;

  return orgContext.lock(async () => {
    await callback(context, orgContext);
  });
};

export const createHandlerOrgChange = <
  T extends { organization: { id: number; login: string } }
>(
  mongoStores: MongoStores,
  callback: CallbackContextAndOrgContext<T>,
) => (context: Context<T>) => {
  return handlerOrgChange(mongoStores, context, callback);
};
