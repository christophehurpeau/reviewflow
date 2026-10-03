import { Icon, Text, View } from "alouette";
import { ConfettiRegularIcon } from "alouette-icons/phosphor-icons/Confetti";
import type { ReactNode } from "react";

export function PrsEmptyState(): ReactNode {
  return (
    <View className="items-center gap-sm py-xl">
      <Icon icon={<ConfettiRegularIcon />} size={48} className="text-muted" />
      <Text className="text-center font-heading-bold text-lg">
        It looks like you don&apos;t have any PR to review!
      </Text>
      <Text className="text-center font-body text-muted">
        Nothing is waiting for you, and none of your pull requests are in
        progress.
      </Text>
    </View>
  );
}
