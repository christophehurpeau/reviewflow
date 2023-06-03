import { cleanTitle } from './prTitle';

describe('cleanTitle', () => {
  it('should clean dash before jira issue', () => {
    expect(cleanTitle('feat: add something - ONK-1234')).toBe(
      'feat: add something ONK-1234',
    );
    expect(cleanTitle('feat: add something - CORE-1234')).toBe(
      'feat: add something CORE-1234',
    );
  });

  it('should clean space before ONK', () => {
    expect(cleanTitle('feat: add something   ONK-1234')).toBe(
      'feat: add something ONK-1234',
    );
  });

  it('should clean dash and space before ONK', () => {
    expect(cleanTitle('feat: add something  -  ONK-1234')).toBe(
      'feat: add something ONK-1234',
    );
  });

  it('should support space instead of dash', () => {
    expect(cleanTitle('feat: add something ONK 1234')).toBe(
      'feat: add something ONK-1234',
    );
  });

  it('should support lowercase onk', () => {
    expect(cleanTitle('feat: add something onk-1234')).toBe(
      'feat: add something ONK-1234',
    );
    expect(cleanTitle('feat: add something onk 1234')).toBe(
      'feat: add something ONK-1234',
    );
  });

  it('should support ticket with number', () => {
    expect(cleanTitle('feat: add something c0re-1234')).toBe(
      'feat: add something C0RE-1234',
    );
    expect(cleanTitle('feat: add something c0re 1234')).toBe(
      'feat: add something C0RE-1234',
    );
  });

  it('should clean uppercase and slash', () => {
    expect(cleanTitle('Feat/add something')).toBe('feat: add something');
  });

  it('should write correct revert', () => {
    expect(
      cleanTitle('Revert "chore(deps): update node.js to v8.14 (#296)"'),
    ).toBe('revert: chore(deps): update node.js to v8.14');
  });

  it('should write correct revert with no issue', () => {
    expect(
      cleanTitle(
        'Revert "chore(deps): update node.js to v8.14 (#296)" [no issue]',
      ),
    ).toBe('revert: chore(deps): update node.js to v8.14 [no issue]');
  });

  it('should clean no issue', () => {
    expect(cleanTitle('feat: add something [no issue[')).toBe(
      'feat: add something [no issue]',
    );
    expect(cleanTitle('feat: add something [noissue]')).toBe(
      'feat: add something [no issue]',
    );
    expect(cleanTitle('feat: add something    [noissue     ]')).toBe(
      'feat: add something [no issue]',
    );
    expect(cleanTitle('feat: add something    [no     issue]    ')).toBe(
      'feat: add something [no issue]',
    );
    expect(cleanTitle('feat: add something [no isssue]')).toBe(
      'feat: add something [no issue]',
    );
    expect(cleanTitle('feat: add something (no issue)')).toBe(
      'feat: add something [no issue]',
    );
    expect(cleanTitle('feat: add something [no-issue]')).toBe(
      'feat: add something [no issue]',
    );
  });
});
