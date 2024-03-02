import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LabelList } from '../../../../../accountConfigs/types';
import initialSimpleV1 from './mocks/commentBody-v1-initial-simple';
import initialAfterEditSimpleV1 from './mocks/commentBody-v1-initialAfterEdit-simple';
import initialAfterEditSimpleWithInfosV1 from './mocks/commentBody-v1-initialAfterEdit-simpleWithInfos';
import initialAfterEditSimpleV2 from './mocks/commentBody-v2-initialAfterEdit-simple';
import initialAfterEditSimpleWithInfosV2 from './mocks/commentBody-v2-initialAfterEdit-simpleWithInfos';
import type { Options } from './prOptions';
import type { RepositorySettings } from './repositorySettings';
import {
  updateCommentOptions,
  updateCommentBodyCommitsNotes,
  updateCommentBodyInfos,
} from './updateBody';

const repositorySettings: RepositorySettings = {
  defaultBranch: 'main',
  deleteBranchOnMerge: false,
  allowAutoMerge: false,
  allowRebaseMerge: false,
  allowSquashMerge: true,
  allowMergeCommit: true,
};

const defaultConfig: Options = {
  autoMerge: false,
  autoMergeWithSkipCi: false,
  deleteAfterMerge: false,
};

const repoLinkMock = 'https://github.com/christophehurpeau/reviewflow';
const labels: LabelList = {
  /* auto merge */
  'merge/automerge': {
    name: ':vertical_traffic_light: automerge',
    color: '#64DD17',
  },
  'merge/skip-ci': {
    name: ':vertical_traffic_light: skip-ci',
    color: '#e1e8ed',
  },
  'merge/update-branch': {
    name: ':arrows_counterclockwise: update branch',
    color: '#64DD17',
  },
};

const initialAfterEditSimpleLatest = initialAfterEditSimpleV2;
const initialAfterEditSimpleWithInfosLatest = initialAfterEditSimpleWithInfosV2;

[
  {
    versionNumber: 1,
    initialSimple: initialSimpleV1,
    initialAfterEditSimple: initialAfterEditSimpleV1,
    initialAfterEditSimpleWithInfos: initialAfterEditSimpleWithInfosV1,
  },
  {
    versionNumber: 2,
    initialSimple: initialSimpleV1,
    initialAfterEditSimple: initialAfterEditSimpleV2,
    initialAfterEditSimpleWithInfos: initialAfterEditSimpleWithInfosV1,
  },
].forEach(
  ({
    versionNumber,
    initialSimple,
    initialAfterEditSimple,
    initialAfterEditSimpleWithInfos,
  }) => {
    describe(`v${versionNumber}`, () => {
      it('should update initial description', () => {
        assert.equal(updateCommentOptions(
          repositorySettings,
          repoLinkMock,
          labels,
          initialSimple,
          defaultConfig,
        ).commentBody, initialAfterEditSimpleLatest);
      });

      it('should keep infos on update', () => {
        assert.equal(updateCommentOptions(
          repositorySettings,
          repoLinkMock,
          labels,
          initialAfterEditSimpleWithInfos,
          defaultConfig,
        ).commentBody, initialAfterEditSimpleWithInfosLatest);
      });

      it('should update options', () => {
        assert.equal(updateCommentOptions(
          repositorySettings,
          repoLinkMock,
          labels,
          initialAfterEditSimpleWithInfos,
          defaultConfig,
          {
            autoMerge: true,
          },
        ).commentBody, initialAfterEditSimpleWithInfosLatest.replace(
          '- [ ] <!-- reviewflow-autoMerge -->',
          '- [x] <!-- reviewflow-autoMerge -->',
        ));
      });

      it('should update commit notes', () => {
        assert.equal(updateCommentBodyCommitsNotes(
          initialAfterEditSimpleWithInfos,
          'Some commits Notes',
        ), initialAfterEditSimpleWithInfos.replace(
          '### Options:',
          '### Commits Notes:\n\nSome commits Notes\n\n### Options:',
        ));
      });

      it('should remove commit notes', () => {
        assert.equal(updateCommentBodyCommitsNotes(
          initialAfterEditSimpleWithInfos.replace(
            '### Options:',
            '### Commits Notes:\n\nSome commits Notes\n\n### Options:',
          ),
          '',
        ), initialAfterEditSimpleWithInfos);
      });

      it('should add infos when there is none', () => {
        assert.equal(updateCommentBodyInfos(initialAfterEditSimple, [
          {
            type: 'success',
            inBody: true,
            title: 'Test',
            url: 'http://test.com',
            summary: 'Test summary',
          },
        ]), initialAfterEditSimple.replace(
          '### Options:',
          '### Infos:\n\n[Test](http://test.com)\n\n### Options:',
        ));
      });

      it('should update infos', () => {
        assert.equal(updateCommentBodyInfos(
          initialAfterEditSimple.replace(
            '### Options:',
            '### Infos:\n\n[Test](http://test.com)\n\n### Options:',
          ),
          [
            {
              type: 'success',
              inBody: true,
              title: 'Test Updated',
              url: 'http://test.com',
              summary: 'Test summary',
            },
          ],
        ), initialAfterEditSimple.replace(
          '### Options:',
          '### Infos:\n\n[Test Updated](http://test.com)\n\n### Options:',
        ));
      });

      it('should remove infos', () => {
        assert.equal(updateCommentBodyInfos(
          initialAfterEditSimple.replace(
            '### Options:',
            '### Infos:\n\n[Test](http://test.com)\n\n### Options:',
          ),
          [],
        ), initialAfterEditSimple);
      });
    });
  },
);

describe('Repository Options', () => {
  it('should show automerge if in default options', () => {
    assert.equal(updateCommentOptions(
      { ...repositorySettings, deleteBranchOnMerge: false },
      repoLinkMock,
      labels,
      initialSimpleV1,
      { ...defaultConfig, deleteAfterMerge: true },
    ).commentBody, initialAfterEditSimpleLatest.replace(
      '### Actions',
      '- [x] <!-- reviewflow-deleteAfterMerge -->:recycle: Automatically delete the branch after this PR is merged. (:warning: Legacy Option: [Delete branch with Github Setting](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-the-automatic-deletion-of-branches))\n### Actions',
    ));
  });
});
