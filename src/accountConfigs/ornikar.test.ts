import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldIgnoreRepo } from '../context/repoContext';
import ornikarConfig from './ornikar';

describe('ignoreRepoPattern', () => {
  it('should ignore some repositories', () => {
    assert.equal(shouldIgnoreRepo('shared-config', ornikarConfig), false);
    assert.equal(shouldIgnoreRepo('infra-config', ornikarConfig), true);
    assert.equal(shouldIgnoreRepo('devenv', ornikarConfig), true);
  });
});

describe('parsePR.body', () => {
  it('should fail with empty description', () => {
    assert.equal(ornikarConfig.parsePR?.body?.[0]?.createStatusInfo(
      ['', ''],
      {} as any,
      false,
    ), {
      summary: 'The PR body should not be empty',
      title: 'Body is empty',
      type: 'failure',
    });
  });
  it('should success with not empty description', () => {
    assert.equal(ornikarConfig.parsePR?.body?.[0]?.createStatusInfo(
      ['', 'something'],
      {} as any,
      false,
    ), null);
  });
  it('should fail on empty template description', () => {
    assert.equal(ornikarConfig.parsePR?.body?.[0]?.createStatusInfo(
      [
        '',
        `### Context

  <!-- Explain here why this PR is needed -->

  ### Solution

  <!-- Explain here the solution you chose for this -->

  <!-- Uncomment this if you need a testing plan
  ### Testing plan
  - [ ] Test this
  - [ ] Test that
  -->`,
      ],
      {} as any,
      false,
    ), {
      type: 'failure',
      title: 'Body has no meaningful content',
      summary: 'The PR body should not contains only titles and comments',
    });
  });
  it('should success on filled template description', () => {
    assert.equal(ornikarConfig.parsePR?.body?.[0]?.createStatusInfo(
      [
        '',
        `### Context

  This is the context

  ### Solution

  This is the solution

  <!-- Uncomment this if you need a testing plan
  ### Testing plan
  - [ ] Test this
  - [ ] Test that
  -->`,
      ],
      {} as any,
      false,
    ), null);
  });
});
