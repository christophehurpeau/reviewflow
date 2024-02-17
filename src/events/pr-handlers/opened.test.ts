// eslint-disable-next-line import/no-extraneous-dependencies
import { jest } from '@jest/globals';
import type { Probot } from 'probot';
import pullRequestOpened from '../../__fixtures__/pull_request_30.opened.json';
import pullRequestCommits from '../../__fixtures__/pull_request_30_commits.json';
import { voidTeamSlack } from '../../context/slack/voidTeamSlack';
import {
  initializeProbotApp,
  mockAccessToken,
  mockLabels,
  nock,
} from '../../tests/setup';
import type { ProbotEvent } from '../probot-types';
import commentBodyV2InitialAfterEditSimple from './actions/utils/body/mocks/commentBody-v2-initialAfterEdit-simpleWithProgress';

jest.unstable_mockModule('../../context/slack/initTeamSlack', () => ({
  initTeamSlack: () => Promise.resolve(voidTeamSlack()),
}));

nock.disableNetConnect();

describe('opened', (): void => {
  let probot: Probot;
  const findOnePr = jest.fn(() => Promise.resolve(undefined));
  const insertOnePr = jest.fn(() => Promise.resolve({ commentId: 1 }));
  const partialUpdateOnePr = jest.fn();

  beforeEach(async () => {
    probot = await initializeProbotApp({
      prs: {
        findOne: findOnePr,
        insertOne: insertOnePr,
        partialUpdateOne: partialUpdateOnePr,
      },
    });
    mockAccessToken();
    mockLabels();
  });

  test('edits the pull request when pull request is opened', async (): Promise<void> => {
    const scope = nock('https://api.github.com')
      .get('/repos/reviewflow/reviewflow-test/issues/30/comments')
      .times(1)
      .reply(200, [])

      .post(
        '/repos/reviewflow/reviewflow-test/issues/30/comments',
        '{"body":"This will be auto filled by reviewflow."}',
      )
      .reply(200, (uri, body) => body)

      .patch('/repos/reviewflow/reviewflow-test/issues/comments/1', (body) => {
        expect(body).toEqual({
          body: commentBodyV2InitialAfterEditSimple.replace(
            /christophehurpeau\/reviewflow/g,
            'reviewflow/reviewflow-test',
          ),
        });
        return true;
      })
      .reply(200, (uri, body) => body)

      .get('/repos/reviewflow/reviewflow-test/pulls/30/commits?per_page=100')
      .reply(200, pullRequestCommits)

      .post(
        '/repos/reviewflow/reviewflow-test/issues/30/assignees',
        '{"assignees":["christophehurpeau"]}',
      )
      .reply(200, {})

      .post(
        '/repos/reviewflow/reviewflow-test/issues/30/labels',
        '{"labels":[":ok_hand: code/needs-review"]}',
      )
      .reply(200, [
        {
          id: 1_210_432_920,
          node_id: 'MDU6TGFiZWwxMjEwNDMyOTIw',
          url: 'https://api.github.com/repos/reviewflow/reviewflow-test/labels/:ok_hand:%20code/needs-review',
          name: ':ok_hand: code/needs-review',
          color: '9e6a03',
          default: false,
          description: null,
        },
      ])

      .get(
        '/repos/reviewflow/reviewflow-test/commits/2ab411d5c55f25f3dc2de6a3244f290a804e33da/check-runs?per_page=100',
      )
      .times(2)
      .reply(200, { check_runs: [] })

      .get('/repos/reviewflow/reviewflow-test/pulls/30/reviews')
      .reply(200, [])

      .get(
        '/repos/reviewflow/reviewflow-test/commits/2ab411d5c55f25f3dc2de6a3244f290a804e33da/status?per_page=100',
      )
      .reply(200, { statuses: [] })

      .post(
        '/repos/reviewflow/reviewflow-test/statuses/2ab411d5c55f25f3dc2de6a3244f290a804e33da',
        '{"context":"reviewflow-dev/lint-pr","state":"success","description":"✓ PR is valid"}',
      )
      .reply(200, {})

      .post(
        '/repos/reviewflow/reviewflow-test/statuses/2ab411d5c55f25f3dc2de6a3244f290a804e33da',
        '{"context":"reviewflow-dev","state":"failure","description":"Awaiting review... Perhaps request someone ?"}',
      )
      .reply(200, {});

    await probot.receive({
      id: '1',
      name: pullRequestOpened.event as any,
      //https://github.com/microsoft/TypeScript/issues/32063
      payload:
        pullRequestOpened.payload as ProbotEvent<'pull_request.opened'>['payload'],
    });

    expect(insertOnePr).toHaveBeenCalled();
    expect(partialUpdateOnePr).toHaveBeenCalled();
    expect(scope.pendingMocks()).toEqual([]);
    expect(scope.activeMocks()).toEqual([]);
  });
});
