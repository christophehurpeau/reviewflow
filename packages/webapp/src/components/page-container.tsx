import { VStack } from "alouette";
import type { ReactNode } from "react";

/** Shared page gutter, so header, nav and content stay aligned at every width. */
export const pageContainerClassName =
  "mx-auto w-full max-w-[960px] px-l xl:max-w-[1280px] xl:px-xl";

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
