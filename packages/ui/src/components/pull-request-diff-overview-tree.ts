export interface OverviewTreeRow {
  /** `workspaceIdOf` or `fileIdOf`: a workspace and a file may share a path */
  id: string;
  kind: "file" | "workspace";
  /** 1 for a workspace, 2 for its files, 3 for a test below its subject */
  level: 1 | 2 | 3;
  parent: string | null;
  /** a workspace's rows are listed; false for a file */
  expanded: boolean;
}

export const workspaceIdOf = (name: string): string => `workspace:${name}`;
export const fileIdOf = (path: string): string => `file:${path}`;

export type OverviewTreeAction =
  | { type: "focus"; id: string }
  | { type: "press"; id: string }
  | { type: "toggle"; id: string };

/**
 * What a key does on the focused row, as the WAI-ARIA tree pattern has it:
 * up and down move a row, home and end to either end, right opens a closed
 * workspace or enters an open one, left closes an open workspace or goes up to
 * the parent, space presses the row. Enter is left to the pressable, which
 * presses on it already. Null for any other key.
 */
export const overviewTreeActionOf = (
  rows: readonly OverviewTreeRow[],
  focusedId: string,
  key: string,
): OverviewTreeAction | null => {
  const index = rows.findIndex(({ id }) => id === focusedId);
  const row = rows[index];
  if (row === undefined) return null;
  const focus = (
    target: OverviewTreeRow | undefined,
  ): OverviewTreeAction | null =>
    target === undefined ? null : { type: "focus", id: target.id };
  if (key === "ArrowDown") return focus(rows[index + 1]);
  if (key === "ArrowUp") return focus(rows[index - 1]);
  if (key === "Home") return focus(rows[0]);
  if (key === "End") return focus(rows.at(-1));
  if (key === " ") return { type: "press", id: row.id };
  if (key === "ArrowRight") {
    if (row.kind === "file") return null;
    if (!row.expanded) return { type: "toggle", id: row.id };
    const child = rows[index + 1];
    return child?.parent === row.id ? focus(child) : null;
  }
  if (key === "ArrowLeft") {
    if (row.kind === "workspace" && row.expanded) {
      return { type: "toggle", id: row.id };
    }
    return row.parent === null ? null : { type: "focus", id: row.parent };
  }
  return null;
};
