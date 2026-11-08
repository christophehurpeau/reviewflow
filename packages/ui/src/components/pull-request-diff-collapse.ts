import { useMemo, useState } from "react";

export interface PullRequestCollapse {
  /** `byDefault`: what the file does until the reader chose, e.g. viewed files start closed */
  isCollapsed: (fileKey: string, byDefault: boolean) => boolean;
  set: (fileKey: string, collapsed: boolean) => void;
  expandAll: () => void;
  collapseAll: () => void;
}

interface CollapseState {
  /** null: no "all" pressed, every file follows its own default */
  all: boolean | null;
  overrides: Readonly<Record<string, boolean>>;
}

export const usePullRequestCollapse = (): PullRequestCollapse => {
  const [state, setState] = useState<CollapseState>({
    all: null,
    overrides: {},
  });

  // stable until a press, so the memoized viewer is not rendered again for nothing
  return useMemo(
    () => ({
      isCollapsed: (fileKey, byDefault) =>
        state.overrides[fileKey] ?? state.all ?? byDefault,
      set: (fileKey, collapsed) => {
        setState((previous) => ({
          all: previous.all,
          overrides: { ...previous.overrides, [fileKey]: collapsed },
        }));
      },
      expandAll: () => {
        setState({ all: false, overrides: {} });
      },
      collapseAll: () => {
        setState({ all: true, overrides: {} });
      },
    }),
    [state],
  );
};
