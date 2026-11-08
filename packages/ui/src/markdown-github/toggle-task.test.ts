import { describe, expect, it } from "vitest";
import { parseMarkdown } from "@tanstack/markdown/parser";
import { pairGithubHtml } from "./pair-html.ts";
import { toggleTask } from "./toggle-task.ts";

describe("toggleTask", () => {
  it("flips the Nth marker both ways, [X] included", () => {
    const source = "- [ ] a\n- [x] b\n- [X] c";
    expect(toggleTask(source, 0)).toBe("- [x] a\n- [x] b\n- [X] c");
    expect(toggleTask(source, 1)).toBe("- [ ] a\n- [ ] b\n- [X] c");
    expect(toggleTask(source, 2)).toBe("- [ ] a\n- [x] b\n- [ ] c");
  });

  it("ignores markers inside fenced code, whatever the fence", () => {
    const source = [
      "- [ ] real",
      "```md",
      "- [ ] fake",
      "```",
      "~~~~",
      "- [ ] fake",
      "~~~",
      "- [ ] still fake",
      "~~~~",
      "- [x] second real",
    ].join("\n");
    expect(toggleTask(source, 1)).toBe(
      source.replace("[x] second", "[ ] second"),
    );
    expect(toggleTask(source, 2)).toBeNull();
  });

  it("does not close a fence with a shorter or different one", () => {
    const source = "````\n```\n- [ ] fake\n````\n- [ ] real";
    expect(toggleTask(source, 0)).toBe(
      "````\n```\n- [ ] fake\n````\n- [x] real",
    );
  });

  it("handles nested, ordered and quoted lists", () => {
    const source =
      "1. [ ] one\n   - [ ] nested\n2) [x] two\n> * [ ] quoted\n+ plain";
    expect(toggleTask(source, 1)).toBe(
      "1. [ ] one\n   - [x] nested\n2) [x] two\n> * [ ] quoted\n+ plain",
    );
    expect(toggleTask(source, 3)).toBe(
      "1. [ ] one\n   - [ ] nested\n2) [x] two\n> * [x] quoted\n+ plain",
    );
  });

  it("only flips a marker, never other brackets", () => {
    expect(toggleTask("- [ ] a [ ] b\ntext [ ]", 0)).toBe(
      "- [x] a [ ] b\ntext [ ]",
    );
  });

  it("keeps CRLF line endings", () => {
    expect(toggleTask("- [ ] a\r\n- [ ] b\r\n", 1)).toBe(
      "- [ ] a\r\n- [x] b\r\n",
    );
  });

  it("returns null when the markers differ from the parser's tasks", () => {
    const source = "- [ ] a\n- [ ] b";
    const a = { checked: false, text: "a" };
    const b = { checked: false, text: "b" };
    expect(toggleTask(source, 0, [a, b])).not.toBeNull();
    expect(toggleTask(source, 0, [a])).toBeNull();
    expect(toggleTask(source, 0, [a, { checked: true, text: "b" }])).toBeNull();
    expect(
      toggleTask(source, 0, [a, { checked: false, text: "c" }]),
    ).toBeNull();
    expect(toggleTask(source, 5)).toBeNull();
  });

  const tasksOf = (source: string) =>
    pairGithubHtml(parseMarkdown(source, { allowHtml: true }).children).tasks;

  it("refuses when an html block and a nested marker would cancel out in a count", () => {
    const source = "<details>\n- [ ] inside html\n</details>\n\n- - [ ] nested";
    const tasks = tasksOf(source);
    expect(tasks).toEqual([{ checked: false, text: "nested" }]);
    expect(toggleTask(source, 0, tasks)).toBe(
      "<details>\n- [ ] inside html\n</details>\n\n- - [x] nested",
    );
  });

  it("skips markers inside an html block, and finds them after its blank line", () => {
    const source = "<div>\n- [ ] raw\n\n- [ ] parsed\n</div>";
    const tasks = tasksOf(source);
    expect(toggleTask(source, 0, tasks)).toBe(
      "<div>\n- [ ] raw\n\n- [x] parsed\n</div>",
    );
  });

  it("matches formatted task text as the parser reads it", () => {
    const source =
      "- [ ] **bold** and `code` [link](https://x.test)\r\n- [x] b";
    expect(toggleTask(source, 1, tasksOf(source))).toBe(
      "- [ ] **bold** and `code` [link](https://x.test)\r\n- [ ] b",
    );
  });

  it("stays read-only when it cannot tell a line is the parser's task", () => {
    const source = "- [ ] see [the doc][ref]\n\n[ref]: https://x.test";
    expect(tasksOf(source)).toEqual([{ checked: false, text: "see the doc" }]);
    expect(toggleTask(source, 0, tasksOf(source))).toBeNull();
  });

  it("works on the reviewflow comment", () => {
    const source =
      "<!-- reviewflow-autoMerge -->\n- [ ] :vertical_traffic_light: automerge : Automatically merge when this PR is ready and has no failed statuses.";
    const { taskCount, tasks } = pairGithubHtml(
      parseMarkdown(source, { allowHtml: true }).children,
    );
    expect(taskCount).toBe(1);
    expect(toggleTask(source, 0, tasks)).toBe(source.replace("[ ]", "[x]"));
  });

  it("handles tasks whose line starts with an html comment (reviewflow options)", () => {
    const source = [
      "### Options:",
      "- [ ] <!-- reviewflow-autoMerge -->[:vertical_traffic_light: automerge](https://github.com/acme/widgets/labels/%3Avertical_traffic_light%3A%20automerge): Automatically merge. When the repository requires _branches to be up to date before merging_, it merges.",
      "- [ ] <!-- reviewflow-autoMergeWithSkipCi -->[:vertical_traffic_light: skip-ci](https://github.com/x): Add `[skip ci]` on merge commit.",
      "### Actions:",
      "- [ ] <!-- reviewflow-updateChecks -->:bug: Force updating reviewflow checks.",
    ].join("\n");
    const { children, taskCount, tasks } = pairGithubHtml(
      parseMarkdown(source, { allowHtml: true }).children,
    );
    expect(taskCount).toBe(3);

    const lines = source.split("\n");
    [1, 2, 4].forEach((lineIndex, taskIndex) => {
      const expected = lines.map((line, index) =>
        index === lineIndex ? line.replace("[ ]", "[x]") : line,
      );
      expect(toggleTask(source, taskIndex, tasks)?.split("\n")).toEqual(
        expected,
      );
    });

    const list = children.find((node) => node.type === "list");
    if (list?.type !== "list") throw new Error("not a list");
    const paragraph = list.items[0]?.children[0];
    if (paragraph?.type !== "paragraph") throw new Error("not a paragraph");
    expect(paragraph.children.map((node) => node.type)).toEqual([
      "link",
      "text",
      "emphasis",
      "text",
    ]);
  });
});
