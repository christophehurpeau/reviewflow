import { parseBody } from './parseBody';
import initialSimple from './mocks/body/initial-simple';
import initialTable from './mocks/body/initial-table';

describe('simple', () => {
  it('should parse default description', () => {
    const defaultConfig = {
      featureBranch: false,
      deleteAfterMerge: true,
    };

    const parsed = parseBody(initialSimple, defaultConfig);

    expect(parsed).not.toBeFalsy();
    expect(parsed && parsed.options).toEqual({
      featureBranch: false,
      deleteAfterMerge: true,
    });
  });
});

describe('table', () => {
  it('should parse default description', () => {
    const defaultConfig = {
      featureBranch: false,
      deleteAfterMerge: true,
    };

    const parsed = parseBody(initialTable, defaultConfig);

    expect(parsed).not.toBeFalsy();
    expect(parsed && parsed.options).toEqual({
      featureBranch: false,
      deleteAfterMerge: true,
    });
  });
});
