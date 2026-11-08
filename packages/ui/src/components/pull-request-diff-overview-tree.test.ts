import { describe, expect, it } from "vitest";
import type { OverviewTreeRow } from "./pull-request-diff-overview-tree.ts";
import {
  fileIdOf,
  overviewTreeActionOf,
  workspaceIdOf,
} from "./pull-request-diff-overview-tree.ts";

const app = workspaceIdOf("packages/app");
const sdk = workspaceIdOf("packages/sdk");
const totals = fileIdOf("packages/sdk/src/totals.ts");
const totalsTest = fileIdOf("packages/sdk/src/totals.test.ts");

const rows: OverviewTreeRow[] = [
  { id: app, kind: "workspace", level: 1, parent: null, expanded: false },
  { id: sdk, kind: "workspace", level: 1, parent: null, expanded: true },
  { id: totals, kind: "file", level: 2, parent: sdk, expanded: false },
  { id: totalsTest, kind: "file", level: 3, parent: totals, expanded: false },
];

describe("overviewTreeActionOf", () => {
  it("moves a row down and up, stopping at either end", () => {
    expect(overviewTreeActionOf(rows, sdk, "ArrowDown")).toEqual({
      type: "focus",
      id: totals,
    });
    expect(overviewTreeActionOf(rows, sdk, "ArrowUp")).toEqual({
      type: "focus",
      id: app,
    });
    expect(overviewTreeActionOf(rows, app, "ArrowUp")).toBeNull();
    expect(overviewTreeActionOf(rows, totalsTest, "ArrowDown")).toBeNull();
  });

  it("goes to the first and last rows", () => {
    expect(overviewTreeActionOf(rows, totals, "Home")).toEqual({
      type: "focus",
      id: app,
    });
    expect(overviewTreeActionOf(rows, app, "End")).toEqual({
      type: "focus",
      id: totalsTest,
    });
  });

  it("opens a closed workspace, then enters it", () => {
    expect(overviewTreeActionOf(rows, app, "ArrowRight")).toEqual({
      type: "toggle",
      id: app,
    });
    expect(overviewTreeActionOf(rows, sdk, "ArrowRight")).toEqual({
      type: "focus",
      id: totals,
    });
    expect(overviewTreeActionOf(rows, totals, "ArrowRight")).toBeNull();
  });

  it("closes an open workspace, else goes up to the parent", () => {
    expect(overviewTreeActionOf(rows, sdk, "ArrowLeft")).toEqual({
      type: "toggle",
      id: sdk,
    });
    expect(overviewTreeActionOf(rows, totalsTest, "ArrowLeft")).toEqual({
      type: "focus",
      id: totals,
    });
    expect(overviewTreeActionOf(rows, totals, "ArrowLeft")).toEqual({
      type: "focus",
      id: sdk,
    });
    expect(overviewTreeActionOf(rows, app, "ArrowLeft")).toBeNull();
  });

  it("presses the row on space and ignores other keys", () => {
    expect(overviewTreeActionOf(rows, totals, " ")).toEqual({
      type: "press",
      id: totals,
    });
    expect(overviewTreeActionOf(rows, totals, "Enter")).toBeNull();
    expect(overviewTreeActionOf(rows, totals, "a")).toBeNull();
  });

  it("does nothing for a row no longer listed", () => {
    expect(
      overviewTreeActionOf(rows, fileIdOf("gone.ts"), "ArrowDown"),
    ).toBeNull();
  });
});
