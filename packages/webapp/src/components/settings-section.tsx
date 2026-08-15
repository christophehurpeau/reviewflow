import { Surface, Text, VStack } from "alouette";
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
    <Surface size="md" className="gap-m">
      <Text className="font-heading-bold text-lg">{title}</Text>
      <VStack className="gap-sm">{children}</VStack>
    </Surface>
  );
}
