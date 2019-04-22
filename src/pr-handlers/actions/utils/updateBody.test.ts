import { updateBody } from './updateBody';
import initial from './mocks/body/initial';
import initialAfterEdit from './mocks/body/initialAfterEdit';

it('should update initial description', () => {
  const defaultConfig = {
    featureBranch: false,
    deleteAfterMerge: true,
  };
  expect(updateBody(initial, defaultConfig)).toEqual(initialAfterEdit);
});
