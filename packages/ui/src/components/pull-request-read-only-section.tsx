import { Text, View } from "alouette";
import type { ReactNode } from "react";

/**
 * A sidebar section without an editor, titled as `FormEditableSection` titles
 * the editable ones, so the two kinds read alike side by side.
 */
export function ReadOnlySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): ReactNode {
  return (
    <View className="gap-sm">
      <Text className="font-heading-bold text-xl">{title}</Text>
      {children}
    </View>
  );
}
