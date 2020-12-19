import initialSimple from './mocks/commentBody-initial-simple';
import initialAfterEditSimple from './mocks/commentBody-initialAfterEdit-simple';
import initialAfterEditSimpleWithInfos from './mocks/commentBody-initialAfterEdit-simpleWithInfos';
import {
  updateCommentOptions,
  updateCommentBodyCommitsNotes,
  updateCommentBodyInfos,
} from './updateBody';

const defaultConfig = {
  featureBranch: false,
  autoMergeWithSkipCi: false,
  autoMerge: false,
  deleteAfterMerge: true,
};

describe('simple', () => {
  it('should update initial description', () => {
    expect(
      updateCommentOptions(initialSimple, defaultConfig).commentBody,
    ).toEqual(initialAfterEditSimple);
  });

  it('should keep infos on update', () => {
    expect(
      updateCommentOptions(initialAfterEditSimpleWithInfos, defaultConfig)
        .commentBody,
    ).toEqual(initialAfterEditSimpleWithInfos);
  });

  it('should update options', () => {
    expect(
      updateCommentOptions(initialAfterEditSimpleWithInfos, defaultConfig, {
        featureBranch: true,
      }).commentBody,
    ).toEqual(
      initialAfterEditSimpleWithInfos.replace(
        '- [ ] <!-- reviewflow-featureBranch -->',
        '- [x] <!-- reviewflow-featureBranch -->',
      ),
    );
  });

  it('should update commit notes', () => {
    expect(
      updateCommentBodyCommitsNotes(
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
      updateCommentBodyCommitsNotes(
        initialAfterEditSimpleWithInfos.replace(
          '#### Options:',
          '#### Commits Notes:\n\nSome commits Notes\n\n#### Options:',
        ),
        '',
      ),
    ).toEqual(initialAfterEditSimpleWithInfos);
  });

  it('should add infos when there is none', () => {
    expect(
      updateCommentBodyInfos(initialAfterEditSimple, [
        {
          inBody: true,
          title: 'Test',
          url: 'http://test.com',
          summary: 'Test summary',
        },
      ]),
    ).toEqual(
      initialAfterEditSimple.replace(
        '#### Options:',
        '#### Infos:\n\n[Test](http://test.com)\n\n#### Options:',
      ),
    );
  });

  it('should update infos', () => {
    expect(
      updateCommentBodyInfos(
        initialAfterEditSimple.replace(
          '#### Options:',
          '#### Infos:\n\n[Test](http://test.com)\n\n#### Options:',
        ),
        [
          {
            inBody: true,
            title: 'Test Updated',
            url: 'http://test.com',
            summary: 'Test summary',
          },
        ],
      ),
    ).toEqual(
      initialAfterEditSimple.replace(
        '#### Options:',
        '#### Infos:\n\n[Test Updated](http://test.com)\n\n#### Options:',
      ),
    );
  });

  it('should remove infos', () => {
    expect(
      updateCommentBodyInfos(
        initialAfterEditSimple.replace(
          '#### Options:',
          '#### Infos:\n\n[Test](http://test.com)\n\n#### Options:',
        ),
        [],
      ),
    ).toEqual(initialAfterEditSimple);
  });
});
