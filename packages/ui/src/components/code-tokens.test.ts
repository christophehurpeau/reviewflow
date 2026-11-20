import { describe, expect, it } from "vitest";
import { highlightCode } from "./code-tokens.ts";

const colored = (language: string, code: string): [string, string][] =>
  (highlightCode(language, code) ?? [])
    .filter((token) => token.className !== null)
    .map((token) => [token.text, token.className ?? ""]);

describe("highlightCode", () => {
  it("cuts a fence into tokens that put its text back together", () => {
    const code = 'const answer: number = 42; // the answer\nlog("done");';
    const tokens = highlightCode("ts", code);
    expect(tokens?.map((token) => token.text).join("")).toBe(code);
  });

  it("colors by the editor's roles, through the language's aliases", () => {
    expect(colored("typescript", "const n: number = 42; // why")).toEqual([
      ["const", "text-(color:--md-tok-keyword)"],
      ["number", "text-(color:--md-tok-type)"],
      ["=", "text-(color:--md-tok-keyword)"],
      ["42", "text-(color:--md-tok-constant)"],
      ["// why", "italic text-(color:--md-tok-comment)"],
    ]);
    expect(colored("json", '{ "a": true }')).toEqual([
      ['"a"', "text-(color:--md-tok-property)"],
      ["true", "text-(color:--md-tok-constant)"],
    ]);
  });

  it("leaves plain a fence with no language or one the editor cannot parse", () => {
    expect(highlightCode(undefined, "ls -la")).toBeNull();
    expect(highlightCode("", "ls -la")).toBeNull();
    expect(highlightCode("bash", "ls -la")).toBeNull();
  });
});
