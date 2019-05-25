import { updateBody } from './updateBody';
import initialSimple from './mocks/body/initial-simple';
import initialAfterEditSimple from './mocks/body/initialAfterEdit-simple';
import initialTable from './mocks/body/initial-table';
import initialAfterEditTable from './mocks/body/initialAfterEdit-table';

describe('simple', () => {
  it('should update initial description', () => {
    const defaultConfig = {
      featureBranch: false,
      deleteAfterMerge: true,
    };
    expect(updateBody(initialSimple, defaultConfig).body).toEqual(
      initialAfterEditSimple,
    );
  });
});

describe('table', () => {
  it('should update initial description', () => {
    const defaultConfig = {
      featureBranch: false,
      deleteAfterMerge: true,
    };
    expect(updateBody(initialTable, defaultConfig).body).toEqual(
      initialAfterEditTable,
    );
  });
});
