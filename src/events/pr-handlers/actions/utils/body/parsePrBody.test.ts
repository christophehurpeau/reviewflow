import assert from "node:assert/strict";
import { describe, it } from "node:test";
import initialSimple from './mocks/prBody-initial-simple';
import initialTable from './mocks/prBody-initial-table';
import simple from './mocks/prBody-simple';
import { parsePrBodyWithOptions } from './parsePrBody';

describe('simple', () => {
  it('should parse default description', () => {
    const defaultOptions = {
      autoMerge: false,
      autoMergeWithSkipCi: false,
      deleteAfterMerge: true,
    };

    const parsed = parsePrBodyWithOptions(initialSimple, defaultOptions);

    expect(parsed).not.toBeFalsy();
    assert.equal(parsed?.options, {
      autoMerge: false,
      autoMergeWithSkipCi: false,
      deleteAfterMerge: true,
    });
    assert.equal(parsed?.commitNotes, '');
  });

  it('should parse breaking changes', () => {
    const defaultOptions = {
      autoMerge: false,
      autoMergeWithSkipCi: false,
      deleteAfterMerge: true,
    };

    const parsed = parsePrBodyWithOptions(
      simple.replace(
        '### Options:',
        '### Commits Notes:\n\nSome commits Notes\n\n### Options:',
      ),
      defaultOptions,
    );

    expect(parsed).not.toBeFalsy();
    assert.equal(parsed?.options, {
      autoMerge: false,
      autoMergeWithSkipCi: false,
      deleteAfterMerge: true,
    });
    assert.equal(parsed?.commitNotes, 'Some commits Notes');
  });
});

describe('table', () => {
  it('should parse default description', () => {
    const defaultOptions = {
      autoMerge: false,
      autoMergeWithSkipCi: false,
      deleteAfterMerge: true,
    };

    const parsed = parsePrBodyWithOptions(initialTable, defaultOptions);

    expect(parsed).not.toBeFalsy();
    assert.equal(parsed?.options, {
      autoMerge: false,
      autoMergeWithSkipCi: false,
      deleteAfterMerge: true,
    });
    assert.equal(parsed?.commitNotes, '');
  });
});

describe('table', () => {
  it('should parse edited description', () => {
    const defaultOptions = {
      autoMerge: false,
      autoMergeWithSkipCi: false,
      deleteAfterMerge: true,
    };

    const parsed = parsePrBodyWithOptions(simple, defaultOptions);

    expect(parsed).not.toBeFalsy();
    assert.equal(parsed?.options, {
      autoMerge: false,
      autoMergeWithSkipCi: false,
      deleteAfterMerge: true,
    });
    assert.equal(parsed?.commitNotes, '');
  });
});
