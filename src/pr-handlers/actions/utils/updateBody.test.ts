import { updateBody, updateBodyCommitsNotes } from './updateBody';
import initialSimple from './mocks/body/initial-simple';
import initialAfterEditSimple from './mocks/body/initialAfterEdit-simple';
import initialAfterEditSimpleWithInfos from './mocks/body/initialAfterEdit-simpleWithInfos';
import initialTable from './mocks/body/initial-table';
import initialAfterEditTable from './mocks/body/initialAfterEdit-table';

const defaultConfig = {
  featureBranch: false,
  autoMergeWithSkipCi: false,
  autoMerge: false,
  deleteAfterMerge: true,
};

describe('simple', () => {
  it('should update initial description', () => {
    expect(updateBody(initialSimple, defaultConfig).body).toEqual(
      initialAfterEditSimple,
    );
  });

  it('should keep infos on update', () => {
    expect(
      updateBody(initialAfterEditSimpleWithInfos, defaultConfig).body,
    ).toEqual(initialAfterEditSimpleWithInfos);
  });

  it('should update options', () => {
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
  it('should update commit notes', () => {
    expect(
      updateBodyCommitsNotes(
        initialAfterEditSimpleWithInfos,
        'Some commits Notes',
      ),
    ).toEqual(
      initialAfterEditSimpleWithInfos.replace(
        '#### Options:',
        '#### Commits Notes:\n\nSome commits Notes\n\n#### Options:',
      ),
    );
  });
  it('should remove commit notes', () => {
    expect(
      updateBodyCommitsNotes(
        initialAfterEditSimpleWithInfos.replace(
          '#### Options:',
          '#### Commits Notes:\n\nSome commits Notes\n\n#### Options:',
        ),
        '',
      ),
    ).toEqual(initialAfterEditSimpleWithInfos);
  });
});

describe('table', () => {
  it('should update initial description', () => {
    expect(updateBody(initialTable, defaultConfig).body).toEqual(
      initialAfterEditTable,
    );
  });
});
