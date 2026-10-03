import { Text, View } from "alouette";
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
    <View className="gap-m">
      <Text className="font-heading-extrabold text-xl">{title}</Text>
      <View className="gap-l">{children}</View>
    </View>
  );
}
