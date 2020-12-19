import type { Probot } from 'probot';
import pullRequestOpened from '../../../fixtures/pull_request_30.opened.json';
import pullRequestCommits from '../../../fixtures/pull_request_30_commits.json';
import * as initTeamSlack from '../../context/initTeamSlack';
import { voidTeamSlack } from '../../context/voidTeamSlack';
import {
  initializeProbotApp,
  mockAccessToken,
  mockLabels,
  nock,
} from '../../tests/setup';

jest.spyOn(initTeamSlack, 'initTeamSlack').mockResolvedValue(voidTeamSlack());

nock.disableNetConnect();

describe('opened', (): void => {
  let probot: Probot;
  const insertOnePr = jest.fn().mockResolvedValue({ commentId: 1 });

  beforeEach(() => {
    probot = initializeProbotApp({
      prs: {
        insertOne: insertOnePr,
      },
    });
    mockAccessToken();
    mockLabels();
  });

  test('edits the pull request when pull request is opened', async (): Promise<
    void
  > => {
    const scope = nock('https://api.github.com')
      .post(
        '/repos/reviewflow/reviewflow-test/issues/30/comments',
        '{"body":"This will be auto filled by reviewflow."}',
      )
      .reply(200, (uri, body) => body)

      .patch('/repos/reviewflow/reviewflow-test/issues/comments/1', (body) => {
        expect(body).toEqual({
          body:
            '#### Options:\n- [ ] <!-- reviewflow-featureBranch -->This PR is a feature branch\n- [ ] <!-- reviewflow-autoMergeWithSkipCi -->Add `[skip ci]` on merge commit\n- [ ] <!-- reviewflow-autoMerge -->Auto merge when this PR is ready and has no failed statuses. (Also has a queue per repo to prevent multiple useless "Update branch" triggers)\n- [x] <!-- reviewflow-deleteAfterMerge -->Automatic branch delete after this PR is merged',
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
        '[":ok_hand: code/needs-review"]',
      )
      .reply(200, [
        {
          id: 1_210_432_920,
          node_id: 'MDU6TGFiZWwxMjEwNDMyOTIw',
          url:
            'https://api.github.com/repos/reviewflow/reviewflow-test/labels/:ok_hand:%20code/needs-review',
          name: ':ok_hand: code/needs-review',
          color: 'FFD57F',
          default: false,
          description: null,
        },
      ])

      .get(
        '/repos/reviewflow/reviewflow-test/commits/2ab411d5c55f25f3dc2de6a3244f290a804e33da/check-runs',
      )
      .times(2)
      .reply(200, { check_runs: [] })

      .post(
        '/repos/reviewflow/reviewflow-test/statuses/2ab411d5c55f25f3dc2de6a3244f290a804e33da',
        '{"context":"reviewflow-dev/lint-pr","state":"success","description":"✓ Your PR is valid"}',
      )
      .reply(200, {})

      .post(
        '/repos/reviewflow/reviewflow-test/statuses/2ab411d5c55f25f3dc2de6a3244f290a804e33da',
        '{"context":"reviewflow-dev","state":"failure","description":"Awaiting review from: dev. Perhaps request someone ?"}',
      )
      .reply(200, {});

    await probot.receive({
      id: '1',
      name: pullRequestOpened.event as any,
      payload: pullRequestOpened.payload,
    });

    expect(insertOnePr).toHaveBeenCalled();
    expect(scope.pendingMocks()).toEqual([]);
    expect(scope.activeMocks()).toEqual([]);
  });
});
