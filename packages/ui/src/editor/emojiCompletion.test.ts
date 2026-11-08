import { describe, expect, it } from "vitest";
import { CompletionContext } from "@codemirror/autocomplete";
import { ensureSyntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { emojiCompletionSource, emojiMatches } from "./emojiCompletion.ts";
import { markdownLanguage } from "./extensions.ts";

/** `|` marks the cursor. */
const complete = (docWithCursor: string) => {
  const pos = docWithCursor.indexOf("|");
  const doc = docWithCursor.replace("|", "");
  const state = EditorState.create({ doc, extensions: [markdownLanguage()] });
  ensureSyntaxTree(state, state.doc.length, 5000);
  return emojiCompletionSource(new CompletionContext(state, pos, false));
};

describe("emojiMatches", () => {
  it("ranks the exact name, then name prefixes, then tags", () => {
    const names = emojiMatches("tada").map(({ name }) => name);
    expect(names[0]).toBe("tada");

    const party = emojiMatches("party");
    expect(party.map(({ name }) => name)).toContain("tada");
    expect(party[0]?.name.startsWith("party")).toBe(true);
  });

  it("finds an alias, and inside a name from two characters", () => {
    expect(emojiMatches("+1")[0]).toEqual({ emoji: "👍", name: "+1" });
    expect(emojiMatches("heart").map(({ name }) => name)).toContain(
      "green_heart",
    );
    expect(emojiMatches("zzzzzz")).toEqual([]);
  });
});

describe("emojiCompletionSource", () => {
  it("offers shortcodes from the colon, inserted as typed on GitHub", () => {
    const result = complete("Nice work :tad|");
    expect(result?.from).toBe("Nice work ".length);
    expect(result?.options[0]).toMatchObject({
      label: ":tada:",
      displayLabel: "🎉  :tada:",
    });
  });

  it("stays quiet on a colon glued to a word, a time or a url", () => {
    expect(complete("Note:ta|")).toBeNull();
    expect(complete("at 12:3|")).toBeNull();
    expect(complete("::ta|")).toBeNull();
    expect(complete("see https://x.dev/a:ta|")).toBeNull();
    expect(complete("a bare :|")).toBeNull();
  });

  it("stays quiet in code, where GitHub renders no emoji", () => {
    expect(complete("run `x :ta|`")).toBeNull();
    expect(complete("```\n:ta|\n```")).toBeNull();
  });
});
