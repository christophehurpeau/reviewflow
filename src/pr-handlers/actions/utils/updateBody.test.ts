import { updateBody } from './updateBody';
import initialSimple from './mocks/body/initial-simple';
import initialAfterEditSimple from './mocks/body/initialAfterEdit-simple';
import initialAfterEditSimpleWithInfos from './mocks/body/initialAfterEdit-simpleWithInfos';
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

  it('should keep infos on update', () => {
    const defaultConfig = {
      featureBranch: false,
      deleteAfterMerge: true,
    };
    expect(
      updateBody(initialAfterEditSimpleWithInfos, defaultConfig).body,
    ).toEqual(initialAfterEditSimpleWithInfos);
  });

  it('should update options', () => {
    const defaultConfig = {
      featureBranch: false,
      deleteAfterMerge: true,
    };
    expect(
      updateBody(initialAfterEditSimpleWithInfos, defaultConfig, undefined, {
        featureBranch: true,
      }).body,
    ).toEqual(
      initialAfterEditSimpleWithInfos.replace(
        '- [ ] <!-- reviewflow-featureBranch -->',
        '- [x] <!-- reviewflow-featureBranch -->',
      ),
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
