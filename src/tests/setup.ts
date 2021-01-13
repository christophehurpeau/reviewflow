import nock from 'nock';
import { Probot } from 'probot';
import repoLabels from '../../fixtures/labels.json';
import initApp from '../initApp';

export { nock };

jest.setTimeout(30_000);

process.env.REVIEWFLOW_NAME = 'reviewflow-dev';
const APP_ID = 1;
nock.disableNetConnect();

export const initializeProbotApp = async ({
  orgs,
  users,
  prs,
}: Partial<any> = {}): Promise<Probot> => {
  const probot = new Probot({
    appId: APP_ID,
    privateKey: 'test',
    githubToken: 'test',
  });
  const mockStores = {
    orgs: { findByKey: () => Promise.resolve({ installationId: 1 }), ...orgs },
    users: {
      findByKey: () => Promise.resolve({ installationId: 1 }),
      ...users,
    },
    prs: {
      findOne: () => Promise.resolve({ commentId: 1 }),
      ...prs,
    },
  };

  await probot.load((app) => initApp(app, { mongoStores: mockStores } as any));

  return probot;
};

export const mockAccessToken = (): void => {
  nock.disableNetConnect();
  nock('https://api.github.com')
    .post(`/app/installations/${APP_ID}/access_tokens`)
    .reply(200, { token: 'test' });
};

export const mockLabels = (): void => {
  nock('https://api.github.com')
    .get('/repos/reviewflow/reviewflow-test/labels')
    .query(true)
    .reply(200, repoLabels);
};
