import { AppSidebarLayout, View } from "alouette";
import type { ReactNode } from "react";
import { ReviewflowHeader } from "#/components/app-header.tsx";
import { ReviewflowSidebar } from "#/components/app-sidebar.tsx";

interface ReviewflowShellProps {
  children: ReactNode;
}

/**
 * Signed in chrome: from `md` the sidebar beside the screen, which scrolls on
 * its own; below it, the header scrolling with the screen. The layout is the
 * scroll container and the `main` landmark, so the screen brings neither.
 */
export function ReviewflowShell({ children }: ReviewflowShellProps): ReactNode {
  return (
    <AppSidebarLayout
      sidebarBreakpoint="xl"
      sidebar={<ReviewflowSidebar />}
      header={<ReviewflowHeader />}
    >
      <View className="pb-xl">{children}</View>
    </AppSidebarLayout>
  );
}
