import { ErrorMessage, HStack, Switch, Text, VStack } from "alouette";
import type { ReactNode } from "react";
import { useOperation } from "react-liwi";
import type { MessageCategory, OrgSettings } from "reviewflow-modules";
import { dmMessageCategories, dmMessageLabels } from "#/dm/dmMessageLabels.ts";
import { useReviewflowServices } from "#/services/ReviewflowServicesProvider.tsx";

interface DmSettingsListProps {
  orgId: number;
  defaultDmSettings: OrgSettings["defaultDmSettings"];
  settings: Partial<Record<MessageCategory, boolean>>;
}

export function DmSettingsList({
  orgId,
  defaultDmSettings,
  settings,
}: DmSettingsListProps): ReactNode {
  const { orgsService } = useReviewflowServices();
  const [setDmSetting, { error }] = useOperation(
    orgsService.operations.setDmSetting,
  );

  return (
    <VStack className="gap-xs">
      {error ? <ErrorMessage>{error.message}</ErrorMessage> : null}
      {dmMessageCategories.map((key) => {
        const labelId = `dm-setting-${key}`;
        return (
          <HStack key={key} className="items-center gap-m">
            <Switch
              checked={settings[key] ?? defaultDmSettings[key]}
              aria-labelledby={labelId}
              onValueChange={(value) => {
                setDmSetting({ orgId, key, value }).catch(console.error);
              }}
            />
            <Text nativeID={labelId} className="flex-1 font-body">
              {dmMessageLabels[key]}
            </Text>
          </HStack>
        );
      })}
    </VStack>
  );
}
