import { Probot } from 'probot';
import {
  initializeProbotApp,
  mockAccessToken,
  mockLabels,
  nock,
} from '../tests/setup';
import pullRequestOpened from '../../fixtures/pull_request_30.opened.json';
import pullRequestCommits from '../../fixtures/pull_request_30_commits.json';
import * as initTeamSlack from '../context/initTeamSlack';

jest
  .spyOn(initTeamSlack, 'initTeamSlack')
  .mockResolvedValue(initTeamSlack.voidTeamSlack());

nock.disableNetConnect();

describe('opened', (): void => {
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
      .get('/repos/christophehurpeau/reviewflow-test/pulls/30')
      .reply(200, pullRequestOpened.payload.pull_request)

      .get(
        '/repos/christophehurpeau/reviewflow-test/pulls/30/commits?per_page=100',
      )
      .reply(200, pullRequestCommits)

      .post(
        '/repos/christophehurpeau/reviewflow-test/issues/30/assignees',
        '{"assignees":["christophehurpeau"]}',
      )
      .reply(200, {})

      .post(
        '/repos/christophehurpeau/reviewflow-test/issues/30/labels',
        '[":ok_hand: code/needs-review"]',
      )
      .reply(200, [
        {
          id: 1210432920,
          node_id: 'MDU6TGFiZWwxMjEwNDMyOTIw',
          url:
            'https://api.github.com/repos/christophehurpeau/reviewflow-test/labels/:ok_hand:%20code/needs-review',
          name: ':ok_hand: code/needs-review',
          color: 'FFD57F',
          default: false,
          description: null,
        },
      ])

      .get(
        '/repos/christophehurpeau/reviewflow-test/commits/2ab411d5c55f25f3dc2de6a3244f290a804e33da/check-runs',
      )
      .times(2)
      .reply(200, { check_runs: [] })

      .post(
        '/repos/christophehurpeau/reviewflow-test/statuses/2ab411d5c55f25f3dc2de6a3244f290a804e33da',
        '{"context":"reviewflow-test/lint-pr","state":"success","description":"✓ Your PR is valid"}',
      )
      .reply(200, {})

      .post(
        '/repos/christophehurpeau/reviewflow-test/statuses/2ab411d5c55f25f3dc2de6a3244f290a804e33da',
        '{"context":"reviewflow-test","state":"failure","description":"Awaiting review from: dev. Perhaps request someone ?"}',
      )
      .reply(200, {})

      .patch(
        '/repos/christophehurpeau/reviewflow-test/issues/30',
        '{"body":"### Context\\r\\nExplain here why this PR is needed\\r\\n\\r\\n### Solution\\r\\nIf needed, explain here the solution you chose for this\\r\\n\\r\\n<!-- Uncomment this if you need a testing plan\\r\\n### Testing plan\\r\\n- [ ] Test this\\r\\n- [ ] Test that\\r\\n-->\\r\\n\\r\\n<!-- do not edit after this -->\\n#### Options:\\n- [ ] <!-- reviewflow-featureBranch -->This PR is a feature branch\\n- [ ] <!-- reviewflow-autoMergeWithSkipCi -->Auto merge with `[skip ci]`\\n- [ ] <!-- reviewflow-autoMerge -->Auto merge when this PR is ready and has no failed statuses. (Also has a queue per repo to prevent multiple useless \\"Update branch\\" triggers)\\n- [x] <!-- reviewflow-deleteAfterMerge -->Automatic branch delete after this PR is merged\\n<!-- end - don\'t add anything after this -->\\r\\n"}',
      )
      .reply(200, {});

    await probot.receive({
      id: '1',
      name: pullRequestOpened.event,
      payload: pullRequestOpened.payload,
    });

    expect(scope.isDone()).toBe(true);
  });
});
