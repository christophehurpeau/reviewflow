import { Text, VStack } from "alouette";
import type { ReactNode } from "react";

interface PrGroupSectionProps {
  title: string;
  children: ReactNode;
}

/**
 * One of the two headers of the slack home: the bucket sections it holds are
 * stacked under it.
 */
export function PrGroupSection({
  title,
  children,
}: PrGroupSectionProps): ReactNode {
  return (
    <VStack className="gap-m">
      <Text className="mx-xs font-heading-extrabold text-xl">{title}</Text>
      <VStack className="gap-l">{children}</VStack>
    </VStack>
  );
}
