import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCommitMessage } from './autoMergeIfPossible';
import type { ParsedBody } from './utils/body/parseBody';

describe(createCommitMessage.name, () => {
  it('should create title based on pr title and number', () => {
    const mockPullRequest: any = {
      number: 1,
      title: 'feat: pr title',
    };

    const mockParsedBody: ParsedBody = {
      commitNotes: '',
      options: {
        autoMerge: true,
        autoMergeWithSkipCi: false,
        deleteAfterMerge: false,
      },
    };

    const [title, body] = createCommitMessage({
      pullRequest: mockPullRequest,
      parsedBody: mockParsedBody,
      options: mockParsedBody.options,
    });

    assert.equal(title, 'feat: pr title (#1)');
    assert.equal(body, '');
  });

  it('should add [skip-ci] when option is passed', () => {
    const mockPullRequest: any = {
      number: 1,
      title: 'feat: pr title',
    };

    const mockParsedBody: ParsedBody = {
      commitNotes: '',
      options: {
        autoMerge: true,
        autoMergeWithSkipCi: true,
        deleteAfterMerge: false,
      },
    };

    const [title, body] = createCommitMessage({
      pullRequest: mockPullRequest,
      parsedBody: mockParsedBody,
      options: mockParsedBody.options,
    });

    assert.equal(title, 'feat: pr title [skip ci] (#1)');
    assert.equal(body, '');
  });

  it('should add breaking changes in body', () => {
    const mockPullRequest: any = {
      number: 1,
      title: 'feat: pr title',
    };

    const mockParsedBody: ParsedBody = {
      commitNotes: '',
      options: {
        autoMerge: true,
        autoMergeWithSkipCi: false,
        deleteAfterMerge: false,
      },
    };

    const [title, body] = createCommitMessage({
      pullRequest: mockPullRequest,
      parsedBody: mockParsedBody,
      options: mockParsedBody.options,
    });

    assert.equal(title, 'feat: pr title (#1)');
    assert.equal(body, '');
  });
});
