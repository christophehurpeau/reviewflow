import { parseBodyWithOptions } from './parseBody';
import initialSimple from './mocks/body/initial-simple';
import initialTable from './mocks/body/initial-table';
import initialAfterEditSimple from './mocks/body/initialAfterEdit-simple';

describe('simple', () => {
  it('should parse default description', () => {
    const defaultConfig = {
      featureBranch: false,
      autoMergeWithSkipCi: false,
      autoMerge: false,
      deleteAfterMerge: true,
    };

    const parsed = parseBodyWithOptions(initialSimple, defaultConfig);

    expect(parsed).not.toBeFalsy();
    expect(parsed && parsed.options).toEqual({
      featureBranch: false,
      autoMergeWithSkipCi: false,
      autoMerge: false,
      deleteAfterMerge: true,
    });
    expect(parsed && parsed.breakingChanges).toBe('');
  });

  it('should parse breaking changes', () => {
    const defaultConfig = {
      featureBranch: false,
      autoMergeWithSkipCi: false,
      autoMerge: false,
      deleteAfterMerge: true,
    };

    const parsed = parseBodyWithOptions(
      initialAfterEditSimple.replace(
        '#### Options:',
        '#### Commits Notes:\n\nSome commits Notes\n\n#### Options:',
      ),
      defaultConfig,
    );

    expect(parsed).not.toBeFalsy();
    expect(parsed && parsed.options).toEqual({
      featureBranch: false,
      autoMergeWithSkipCi: false,
      autoMerge: false,
      deleteAfterMerge: true,
    });
    expect(parsed && parsed.breakingChanges).toBe('Some commits Notes');
  });
});

describe('table', () => {
  it('should parse default description', () => {
    const defaultConfig = {
      featureBranch: false,
      autoMergeWithSkipCi: false,
      autoMerge: false,
      deleteAfterMerge: true,
    };

    const parsed = parseBodyWithOptions(initialTable, defaultConfig);

    expect(parsed).not.toBeFalsy();
    expect(parsed && parsed.options).toEqual({
      featureBranch: false,
      autoMergeWithSkipCi: false,
      autoMerge: false,
      deleteAfterMerge: true,
    });
    expect(parsed && parsed.breakingChanges).toBe('');
  });
});

describe('table', () => {
  it('should parse edited description', () => {
    const defaultConfig = {
      featureBranch: true,
      autoMergeWithSkipCi: false,
      autoMerge: false,
      deleteAfterMerge: true,
    };

    const parsed = parseBodyWithOptions(initialAfterEditSimple, defaultConfig);

    expect(parsed).not.toBeFalsy();
    expect(parsed && parsed.options).toEqual({
      featureBranch: false,
      autoMergeWithSkipCi: false,
      autoMerge: false,
      deleteAfterMerge: true,
    });
    expect(parsed && parsed.breakingChanges).toBe('');
  });
});
