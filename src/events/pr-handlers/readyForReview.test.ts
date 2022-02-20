// eslint-disable-next-line import/no-extraneous-dependencies
import { jest } from '@jest/globals';
import type { Probot } from 'probot';
import pullRequestCommits from '../../__fixtures__/pull_request_30_commits.json';
import pullRequestReadyForReview from '../../__fixtures__/pull_request_54.ready_for_review.json';
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

  test('add code review label when pr is ready to be review', async (): Promise<void> => {
    const scope = nock('https://api.github.com')
      .get(
        '/repos/reviewflow/reviewflow-test/issues/comments/1?issue_number=54',
      )
      .times(1)
      .reply(200, {
        id: 1,
        body: '### Options:\n- [ ] <!-- reviewflow-autoMergeWithSkipCi -->Add `[skip ci]` on merge commit\n- [ ] <!-- reviewflow-autoMerge -->Auto merge when this PR is ready and has no failed statuses. (Also has a queue per repo to prevent multiple useless "Update branch" triggers)\n- [x] <!-- reviewflow-deleteAfterMerge -->Automatic branch delete after this PR is merged',
      })

      .get(
        '/repos/reviewflow/reviewflow-test/commits/f354ffb37cf238108fbb4c915f155d925d82a61b/check-runs',
      )
      .times(2)
      .reply(200, { check_runs: [] })

      .get('/repos/reviewflow/reviewflow-test/pulls/54/commits?per_page=100')
      .reply(200, pullRequestCommits)

      .post(
        '/repos/reviewflow/reviewflow-test/issues/54/labels',
        '[":ok_hand: code/needs-review"]',
      )
      .reply(200, [
        {
          id: 1_210_432_920,
          node_id: 'MDU6TGFiZWwxMjEwNDMyOTIw',
          url: 'https://api.github.com/repos/reviewflow/reviewflow-test/labels/:ok_hand:%20code/needs-review',
          name: ':ok_hand: code/needs-review',
          color: 'FFD57F',
          default: false,
          description: null,
        },
      ])

      .post(
        '/repos/reviewflow/reviewflow-test/statuses/f354ffb37cf238108fbb4c915f155d925d82a61b',
        '{"context":"reviewflow-dev/lint-pr","state":"success","description":"✓ PR is valid"}',
      )
      .times(1)
      .reply(200)

      .post(
        '/repos/reviewflow/reviewflow-test/statuses/f354ffb37cf238108fbb4c915f155d925d82a61b',
        '{"context":"reviewflow-dev","state":"failure","description":"Awaiting review from: dev. Perhaps request someone ?"}',
      )
      .times(1)
      .reply(200);

    await probot.receive({
      id: '1',
      name: pullRequestReadyForReview.event as any,
      payload: pullRequestReadyForReview.payload as any,
    });

    expect(partialUpdateOnePr).toHaveBeenNthCalledWith(1, expect.any(Object), {
      $set: {
        lastLintStatusesCommit: 'f354ffb37cf238108fbb4c915f155d925d82a61b',
        lintStatuses: [
          {
            name: 'lint-pr',
            status: {
              summary: '',
              title: '✓ PR is valid',
              type: 'success',
              url: undefined,
            },
          },
        ],
      },
    });
    expect(partialUpdateOnePr).toHaveBeenNthCalledWith(2, expect.any(Object), {
      $set: {
        flowStatus: {
          summary: '',
          title: 'Awaiting review from: dev. Perhaps request someone ?',
          type: 'failure',
        },
        lastFlowStatusCommit: 'f354ffb37cf238108fbb4c915f155d925d82a61b',
      },
    });
    expect(scope.pendingMocks()).toEqual([]);
    expect(scope.activeMocks()).toEqual([]);
  });
});
