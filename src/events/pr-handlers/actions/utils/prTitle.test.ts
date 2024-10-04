import { describe, expect, it } from "vitest";
import { cleanTitle } from "./prTitle";

describe("cleanTitle", () => {
  it("should clean dash before jira issue", () => {
    expect(cleanTitle("feat: add something - ONK-1234", true)).toBe(
      "feat: add something ONK-1234",
    );
    expect(cleanTitle("feat: add something - CORE-1234", true)).toBe(
      "feat: add something CORE-1234",
    );
  });

  it("should clean space before ONK", () => {
    expect(cleanTitle("feat: add something   ONK-1234", true)).toBe(
      "feat: add something ONK-1234",
    );
  });

  it("should clean dash and space before ONK", () => {
    expect(cleanTitle("feat: add something  -  ONK-1234", true)).toBe(
      "feat: add something ONK-1234",
    );
  });

  it("should support space instead of dash", () => {
    expect(cleanTitle("feat: add something ONK 1234", true)).toBe(
      "feat: add something ONK-1234",
    );
  });

  it("should support lowercase onk", () => {
    expect(cleanTitle("feat: add something onk-1234", true)).toBe(
      "feat: add something ONK-1234",
    );
  });

  it("should support ticket with number", () => {
    expect(cleanTitle("feat: add something c0re-1234", true)).toBe(
      "feat: add something C0RE-1234",
    );
  });

  it("should clean uppercase and slash", () => {
    expect(cleanTitle("Feat/add something", true)).toBe("feat: add something");
  });

  it("should clean slash with scope", () => {
    expect(cleanTitle("Feat/scope/add something", true)).toBe(
      "feat(scope): add something",
    );
  });

  it("should clean ;", () => {
    expect(cleanTitle("feat;add something", true)).toBe("feat: add something");
  });

  it("should write correct revert", () => {
    expect(
      cleanTitle('Revert "chore(deps): update node.js to v8.14 (#296)"', true),
    ).toBe("revert: chore(deps): update node.js to v8.14");
  });

  it("should correct revert of revert", () => {
    expect(
      cleanTitle("revert: revert: chore(deps): update node.js to v8.14", true),
    ).toBe("chore(deps): update node.js to v8.14");
  });

  it("should write correct revert with no issue", () => {
    expect(
      cleanTitle(
        'Revert "chore(deps): update node.js to v8.14 (#296)" [no issue]',
        true,
      ),
    ).toBe("revert: chore(deps): update node.js to v8.14 [no issue]");
  });

  it("should keep library name with number", () => {
    expect(cleanTitle("chore(deps): update react 18", true)).toBe(
      "chore(deps): update react 18",
    );
  });

  it("should clean no issue", () => {
    expect(cleanTitle("feat: add something [no issue[", true)).toBe(
      "feat: add something [no issue]",
    );
    expect(cleanTitle("feat: add something [noissue]", true)).toBe(
      "feat: add something [no issue]",
    );
    expect(cleanTitle("feat: add something    [noissue     ]", true)).toBe(
      "feat: add something [no issue]",
    );
    expect(cleanTitle("feat: add something    [no     issue]    ", true)).toBe(
      "feat: add something [no issue]",
    );
    expect(cleanTitle("feat: add something [no isssue]", true)).toBe(
      "feat: add something [no issue]",
    );
    expect(cleanTitle("feat: add something (no issue)", true)).toBe(
      "feat: add something [no issue]",
    );
    expect(cleanTitle("feat: add something [no-issue]", true)).toBe(
      "feat: add something [no issue]",
    );
    expect(cleanTitle("feat: add something - [no-issue]", true)).toBe(
      "feat: add something [no issue]",
    );
    expect(cleanTitle("feat: add something - [no-ticket]", true)).toBe(
      "feat: add something [no ticket]",
    );
  });
});
