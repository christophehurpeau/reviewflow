import { useMemo, useState } from "react";

export interface CollapsedFiles {
  isCollapsed: (fileKey: string) => boolean;
  toggle: (fileKey: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
}

interface CollapsedState {
  allCollapsed: boolean;
  /** the files toggled away from `allCollapsed` since it was last set */
  toggled: ReadonlySet<string>;
}

/**
 * Held by the modal, which has the expand-all and collapse-all buttons but
 * not the file list: the viewer parses the patch and is loaded lazily. Stored
 * as a default plus exceptions, so either "all" needs no list of files and a
 * file new to a refreshed diff follows the last "all" pressed.
 *
 * @deprecated `DiffViewer` and the pull request diff take a
 * `PullRequestCollapse`: use `usePullRequestCollapse`.
 */
export const useCollapsedFiles = (): CollapsedFiles => {
  const [state, setState] = useState<CollapsedState>({
    allCollapsed: false,
    toggled: new Set(),
  });

  // stable until a press, so the memoized viewer is not rendered again for nothing
  return useMemo(
    () => ({
      isCollapsed: (fileKey) =>
        state.allCollapsed !== state.toggled.has(fileKey),
      toggle: (fileKey) => {
        setState((previous) => {
          const toggled = new Set(previous.toggled);
          if (!toggled.delete(fileKey)) toggled.add(fileKey);
          return { allCollapsed: previous.allCollapsed, toggled };
        });
      },
      expandAll: () => {
        setState({ allCollapsed: false, toggled: new Set() });
      },
      collapseAll: () => {
        setState({ allCollapsed: true, toggled: new Set() });
      },
    }),
    [state],
  );
};
