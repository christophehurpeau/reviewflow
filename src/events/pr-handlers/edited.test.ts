// eslint-disable-next-line import/no-extraneous-dependencies
import { jest } from '@jest/globals';
import type { Probot } from 'probot';
import pullRequestEdited from '../../../fixtures/pull_request_30.edited.json';
import { voidTeamSlack } from '../../context/slack/voidTeamSlack';
import {
  initializeProbotApp,
  mockAccessToken,
  mockLabels,
  nock,
} from '../../tests/setup';

jest.unstable_mockModule('../../context/slack/initTeamSlack', () => ({
  initTeamSlack: () => Promise.resolve(voidTeamSlack()),
}));

nock.disableNetConnect();

describe('edited', (): void => {
  let probot: Probot;
  const partialUpdateOnePr = jest.fn();

  beforeEach(async () => {
    probot = await initializeProbotApp({
      prs: {
        partialUpdateOne: partialUpdateOnePr,
      },
    });
    mockAccessToken();
    mockLabels();
  });

  test('edits the pull request when pull request is edited', async (): Promise<void> => {
    const scope = nock('https://api.github.com')
      .get('/repos/reviewflow/reviewflow-test/pulls/30')
      .times(1)
      .reply(200, pullRequestEdited.payload.pull_request)

      .get(
        '/repos/reviewflow/reviewflow-test/issues/comments/1?issue_number=30',
      )
      .times(1)
      .reply(200, {
        id: 1,
        body: '### Options:\n- [ ] <!-- reviewflow-autoMergeWithSkipCi -->Add `[skip ci]` on merge commit\n- [ ] <!-- reviewflow-autoMerge -->Auto merge when this PR is ready and has no failed statuses. (Also has a queue per repo to prevent multiple useless "Update branch" triggers)\n- [x] <!-- reviewflow-deleteAfterMerge -->Automatic branch delete after this PR is merged',
      })

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
      name: pullRequestEdited.event as any,
      payload: pullRequestEdited.payload as any,
    });

    expect(partialUpdateOnePr).toHaveBeenCalled();
    expect(scope.pendingMocks()).toEqual([]);
    expect(scope.activeMocks()).toEqual([]);
  });
});
