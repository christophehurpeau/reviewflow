// eslint-disable-next-line import/no-extraneous-dependencies
import { jest } from '@jest/globals';
import nock from 'nock';
import { Probot } from 'probot';
import repoLabels from '../__fixtures__/labels.json';
import initApp from '../initApp';

export { default as nock } from 'nock';

jest.setTimeout(30_000);

process.env.REVIEWFLOW_NAME = 'reviewflow-dev';
const APP_ID = 1;
nock.disableNetConnect();

export const initializeProbotApp = async ({
  orgs,
  orgMembers,
  users,
  prs,
  repositoryMergeQueue,
  repositories,
}: Partial<any> = {}): Promise<Probot> => {
  const probot = new Probot({
    appId: APP_ID,
    privateKey: 'test',
    githubToken: 'test',
  });
  const mockStores = {
    orgs: {
      findByKey: () => Promise.resolve({ _id: 1, installationId: 1 }),
      ...orgs,
    },
    repositories: {
      findByKey: () =>
        Promise.resolve({ _id: 1, settings: { deleteBranchOnMerge: true } }),
      ...repositories,
    },
    orgMembers: {
      findAll: () => Promise.resolve([]),
      ...orgMembers,
    },
    users: {
      findByKey: () => Promise.resolve({ _id: 1, installationId: 1 }),
      ...users,
    },
    prs: {
      findOne: () => Promise.resolve({ commentId: 1 }),
      ...prs,
    },

    repositoryMergeQueue: {
      findOne: () => Promise.resolve({ queue: [] }),
      ...repositoryMergeQueue,
    },
  };

  await probot.load((app) => {
    initApp(app, { mongoStores: mockStores } as any);
  });

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
