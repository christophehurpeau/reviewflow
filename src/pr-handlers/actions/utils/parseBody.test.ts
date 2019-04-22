import { parseBody } from './parseBody';
import initial from './mocks/body/initial';

it('should parse default description', () => {
  const defaultConfig = {
    featureBranch: false,
    deleteAfterMerge: true,
  };

  const parsed = parseBody(initial, defaultConfig);

  expect(parsed).not.toBeFalsy();
  expect(parsed && parsed.options).toEqual({
    featureBranch: false,
    deleteAfterMerge: true,
  });
});
