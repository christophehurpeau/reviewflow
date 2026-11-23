import { Virtualizer } from "@pierre/diffs";
import { VirtualizerContext } from "@pierre/diffs/react";
import { View } from "alouette";
import type { ComponentRef, ReactNode } from "react";
import { useCallback, useState } from "react";
import { scrollParentOf } from "../scroll-parent.ts";

interface DiffVirtualizerProps {
  children: ReactNode;
}

/**
 * Every `FileDiff` below renders only near the viewport: a file out of view
 * keeps an estimated height and renders nothing, a long file only its visible
 * lines. Without it every file of the diff is highlighted and laid out at
 * once, which is what the diff budget caps.
 *
 * Bound to the scroll container the diff already sits in (the nearest that
 * scrolls, else the document), never one of its own: the diff keeps scrolling
 * with the page, under its sticky toolbar. A file mounted before that binding
 * is queued by pierre and joins once it is made.
 *
 * What is not rendered cannot be found with the browser's find in page. The
 * annotations stay mounted, in light DOM slots, so a comment being written in
 * a file scrolled away keeps its text.
 */
export function DiffVirtualizer({ children }: DiffVirtualizerProps): ReactNode {
  // oxlint-disable-next-line react/hook-use-state -- created once, never replaced
  const [virtualizer] = useState(() =>
    typeof window === "undefined" ? undefined : new Virtualizer(),
  );
  const bind = useCallback(
    (node: ComponentRef<typeof View> | null) => {
      if (virtualizer === undefined || node === null) return;
      const element = node as unknown as HTMLElement;
      virtualizer.setup(scrollParentOf(element) ?? document);
      return () => {
        virtualizer.cleanUp();
      };
    },
    [virtualizer],
  );
  return (
    <VirtualizerContext value={virtualizer}>
      <View ref={bind}>{children}</View>
    </VirtualizerContext>
  );
}
