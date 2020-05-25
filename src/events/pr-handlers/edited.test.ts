import { Probot } from 'probot';
import {
  initializeProbotApp,
  mockAccessToken,
  mockLabels,
  nock,
} from '../../tests/setup';
import pullRequestEdited from '../../../fixtures/pull_request_30.edited.json';
// import pullRequestCommits from '../../fixtures/pull_request_30_commits.json';
import * as initTeamSlack from '../../context/initTeamSlack';
import { voidTeamSlack } from '../../context/voidTeamSlack';

jest.spyOn(initTeamSlack, 'initTeamSlack').mockResolvedValue(voidTeamSlack());

nock.disableNetConnect();

describe('edited', (): void => {
  let probot: Probot;

  beforeEach(() => {
    probot = initializeProbotApp();
    mockAccessToken();
    mockLabels();
  });

  test('edits the pull request when pull request is opened', async (): Promise<
    void
  > => {
    const scope = nock('https://api.github.com')
      .get('/repos/reviewflow/reviewflow-test/pulls/30')
      .times(1)
      .reply(200, pullRequestEdited.payload.pull_request)

      .get(
        '/repos/reviewflow/reviewflow-test/commits/2ab411d5c55f25f3dc2de6a3244f290a804e33da/check-runs',
      )
      .reply(200, { check_runs: [] })

      .post(
        '/repos/reviewflow/reviewflow-test/statuses/2ab411d5c55f25f3dc2de6a3244f290a804e33da',
      )
      .reply(200);

    await probot.receive({
      id: '1',
      name: pullRequestEdited.event,
      payload: pullRequestEdited.payload,
    });

    expect(scope.isDone()).toBe(true);
  });
});
