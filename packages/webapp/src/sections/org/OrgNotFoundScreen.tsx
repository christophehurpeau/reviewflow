import { Button, View, WarningMessage } from "alouette";
import type { ReactNode } from "react";
import { Screen } from "#/components/screen.tsx";

interface OrgNotFoundScreenProps {
  orgLogin: string;
  onBack: () => void;
}

export function OrgNotFoundScreen({
  orgLogin,
  onBack,
}: OrgNotFoundScreenProps): ReactNode {
  return (
    <Screen title={orgLogin}>
      <View className="gap-m">
        <WarningMessage>
          {`You have no access to ${orgLogin}, or reviewflow is not installed on it.`}
        </WarningMessage>
        <Button accent="neutral" text="Back to settings" onPress={onBack} />
      </View>
    </Screen>
  );
}
