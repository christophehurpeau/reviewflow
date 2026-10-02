import { Box, Text, View } from "alouette";
import type { ReactNode } from "react";

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
}

export function SettingsSection({
  title,
  children,
}: SettingsSectionProps): ReactNode {
  return (
    <Box className="surface surface-md gap-m">
      <Text className="font-heading-bold text-lg">{title}</Text>
      <View className="gap-sm">{children}</View>
    </Box>
  );
}
