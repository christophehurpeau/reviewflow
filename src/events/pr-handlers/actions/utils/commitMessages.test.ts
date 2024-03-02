import { describe, test } from "node:test";
import {
  lintCommitMessage,
  commitlintParse,
  parseCommitMessage,
} from './commitMessages';

describe('lintCommitMessage', () => {
  test('valid message', async () => {
    expect(await lintCommitMessage('docs: add readme')).toMatchInlineSnapshot(`
      {
        "errors": [],
        "input": "docs: add readme",
        "valid": true,
        "warnings": [],
      }
    `);
  });

  test('valid message with breaking change', async () => {
    expect(await lintCommitMessage('docs!: add readme')).toMatchInlineSnapshot(`
      {
        "errors": [],
        "input": "docs!: add readme",
        "valid": true,
        "warnings": [],
      }
    `);
  });

  test('invalid message', async () => {
    expect(await lintCommitMessage('add readme')).toMatchInlineSnapshot(`
      {
        "errors": [
          {
            "level": 2,
            "message": "subject may not be empty",
            "name": "subject-empty",
            "valid": false,
          },
          {
            "level": 2,
            "message": "type may not be empty",
            "name": "type-empty",
            "valid": false,
          },
        ],
        "input": "add readme",
        "valid": false,
        "warnings": [],
      }
    `);
  });
});

describe('commitlintParse', () => {
  test('valid message', async () => {
    expect(await commitlintParse('docs: add readme')).toMatchInlineSnapshot(`
      {
        "body": null,
        "footer": null,
        "header": "docs: add readme",
        "mentions": [],
        "merge": null,
        "notes": [],
        "raw": "docs: add readme",
        "references": [],
        "revert": null,
        "scope": null,
        "subject": "add readme",
        "type": "docs",
      }
    `);
  });

  test('valid message with breaking change', async () => {
    expect(await commitlintParse('docs!: add readme')).toMatchInlineSnapshot(`
      {
        "body": null,
        "footer": null,
        "header": "docs!: add readme",
        "mentions": [],
        "merge": null,
        "notes": [],
        "raw": "docs!: add readme",
        "references": [],
        "revert": null,
        "scope": null,
        "subject": null,
        "type": null,
      }
    `);
  });

  test('invalid message', async () => {
    expect(await commitlintParse('add readme')).toMatchInlineSnapshot(`
      {
        "body": null,
        "footer": null,
        "header": "add readme",
        "mentions": [],
        "merge": null,
        "notes": [],
        "raw": "add readme",
        "references": [],
        "revert": null,
        "scope": null,
        "subject": null,
        "type": null,
      }
    `);
  });
});

describe('parseCommitMessage', () => {
  test('valid message', async () => {
    expect(await parseCommitMessage('docs: add readme')).toMatchInlineSnapshot(`
      {
        "body": null,
        "footer": null,
        "header": "docs: add readme",
        "mentions": [],
        "merge": null,
        "notes": [],
        "raw": "docs: add readme",
        "references": [],
        "revert": null,
        "scope": null,
        "subject": "add readme",
        "type": "docs",
      }
    `);
  });

  test('valid message with breaking change', async () => {
    expect(await parseCommitMessage('docs!: add readme'))
      .toMatchInlineSnapshot(`
      {
        "body": null,
        "footer": null,
        "header": "docs!: add readme",
        "mentions": [],
        "merge": null,
        "notes": [
          {
            "text": "add readme",
            "title": "BREAKING CHANGE",
          },
        ],
        "raw": "docs!: add readme",
        "references": [],
        "revert": null,
        "scope": null,
        "subject": "add readme",
        "type": "docs",
      }
    `);
  });

  test('valid message with breaking change and note', async () => {
    expect(
      await parseCommitMessage(
        'docs!: add readme\n\nBREAKING CHANGE: detailed breaking change',
      ),
    ).toMatchInlineSnapshot(`
      {
        "body": null,
        "footer": "BREAKING CHANGE: detailed breaking change",
        "header": "docs!: add readme",
        "mentions": [],
        "merge": null,
        "notes": [
          {
            "text": "detailed breaking change",
            "title": "BREAKING CHANGE",
          },
        ],
        "raw": "docs!: add readme

      BREAKING CHANGE: detailed breaking change",
        "references": [],
        "revert": null,
        "scope": null,
        "subject": "add readme",
        "type": "docs",
      }
    `);
  });

  test('invalid message', async () => {
    expect(await parseCommitMessage('add readme')).toMatchInlineSnapshot(`
      {
        "body": null,
        "footer": null,
        "header": "add readme",
        "mentions": [],
        "merge": null,
        "notes": [],
        "raw": "add readme",
        "references": [],
        "revert": null,
        "scope": null,
        "subject": null,
        "type": null,
      }
    `);
  });
});
