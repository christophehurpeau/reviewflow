import { Text, VStack } from "alouette";
import type { ReactNode } from "react";

interface ListSectionProps {
  title: string;
  children: ReactNode;
}

/**
 * Heading above a list of pressable rows. Rows are raised on their own, so the
 * section stays on the screen background rather than in a Surface.
 */
export function ListSection({ title, children }: ListSectionProps): ReactNode {
  return (
    <VStack className="gap-xs">
      <Text className="mx-xs font-heading-bold text-lg">{title}</Text>
      {children}
    </VStack>
  );
}
