import { AppShell } from "alouette";
import type { ReactNode } from "react";
import { ReviewflowHeader } from "#/components/app-header.tsx";

interface ReviewflowShellProps {
  children: ReactNode;
}

/**
 * Signed in chrome: the header and the page every screen scrolls with. It
 * renders no landmark itself — the route composes the body and brings its own
 * `AppShellMain`, which is what leaves room for a section to put an
 * `AppShellSidebar` beside its own screen later.
 */
export function ReviewflowShell({ children }: ReviewflowShellProps): ReactNode {
  return (
    <AppShell header={<ReviewflowHeader />} contentContainerClassName="pb-xl">
      {children}
    </AppShell>
  );
}
