import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanTitle } from './prTitle';

describe('cleanTitle', () => {
  it('should clean dash before jira issue', () => {
    assert.equal(
      cleanTitle('feat: add something - ONK-1234', true),
      'feat: add something ONK-1234'
    );
    assert.equal(
      cleanTitle('feat: add something - CORE-1234', true),
      'feat: add something CORE-1234'
    );
  });

  it('should clean space before ONK', () => {
    assert.equal(
      cleanTitle('feat: add something   ONK-1234', true),
      'feat: add something ONK-1234'
    );
  });

  it('should clean dash and space before ONK', () => {
    assert.equal(
      cleanTitle('feat: add something  -  ONK-1234', true),
      'feat: add something ONK-1234'
    );
  });

  it('should support space instead of dash', () => {
    assert.equal(
      cleanTitle('feat: add something ONK 1234', true),
      'feat: add something ONK-1234'
    );
  });

  it('should support lowercase onk', () => {
    assert.equal(
      cleanTitle('feat: add something onk-1234', true),
      'feat: add something ONK-1234'
    );
  });

  it('should support ticket with number', () => {
    assert.equal(
      cleanTitle('feat: add something c0re-1234', true),
      'feat: add something C0RE-1234'
    );
  });

  it('should clean uppercase and slash', () => {
    assert.equal(cleanTitle('Feat/add something', true), 'feat: add something');
  });

  it('should clean ;', () => {
    assert.equal(cleanTitle('feat;add something', true), 'feat: add something');
  });

  it('should write correct revert', () => {
    assert.equal(
      cleanTitle('Revert "chore(deps): update node.js to v8.14 (#296)"', true),
      'revert: chore(deps): update node.js to v8.14'
    );
  });

  it('should write correct revert with no issue', () => {
    assert.equal(cleanTitle(
      'Revert "chore(deps): update node.js to v8.14 (#296)" [no issue]',
      true,
    ), 'revert: chore(deps): update node.js to v8.14 [no issue]');
  });

  it('should keep library name with number', () => {
    assert.equal(
      cleanTitle('chore(deps): update react 18', true),
      'chore(deps): update react 18'
    );
  });

  it('should clean no issue', () => {
    assert.equal(
      cleanTitle('feat: add something [no issue[', true),
      'feat: add something [no issue]'
    );
    assert.equal(
      cleanTitle('feat: add something [noissue]', true),
      'feat: add something [no issue]'
    );
    assert.equal(
      cleanTitle('feat: add something    [noissue     ]', true),
      'feat: add something [no issue]'
    );
    assert.equal(
      cleanTitle('feat: add something    [no     issue]    ', true),
      'feat: add something [no issue]'
    );
    assert.equal(
      cleanTitle('feat: add something [no isssue]', true),
      'feat: add something [no issue]'
    );
    assert.equal(
      cleanTitle('feat: add something (no issue)', true),
      'feat: add something [no issue]'
    );
    assert.equal(
      cleanTitle('feat: add something [no-issue]', true),
      'feat: add something [no issue]'
    );
    assert.equal(
      cleanTitle('feat: add something - [no-issue]', true),
      'feat: add something [no issue]'
    );
  });
});
