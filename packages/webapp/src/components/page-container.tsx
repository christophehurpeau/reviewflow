import { VStack } from "alouette";
import type { ReactNode } from "react";

/**
 * Shared page gutter, matching the boxed row `AppHeader` centers its own
 * content in, so header, nav and content stay aligned at every width.
 */
export const pageContainerClassName =
  "mx-auto w-full max-w-[1200px] px-m md:px-l";

interface PageContainerProps {
  className?: string;
  children: ReactNode;
}

export function PageContainer({
  className,
  children,
}: PageContainerProps): ReactNode {
  return (
    <VStack className={[pageContainerClassName, className].join(" ")}>
      {children}
    </VStack>
  );
}
