import { ErrorMessage, Switch, Text, View } from "alouette";
import type { ReactNode } from "react";
import { useState } from "react";
import type { OrgPersonalTokensPolicy } from "reviewflow-modules";
import { NotEnabledMessage } from "#/components/not-enabled-message.tsx";
import { SettingsSection } from "#/components/settings-section.tsx";
import { errorToMessage } from "#/errorToMessage.ts";

const labelId = "allow-personal-tokens";

interface PersonalTokensPolicySectionProps {
  orgLogin: string;
  policy: OrgPersonalTokensPolicy;
  onSetAllow: (allow: boolean) => Promise<void>;
}

export function PersonalTokensPolicySection({
  orgLogin,
  policy,
  onSetAllow,
}: PersonalTokensPolicySectionProps): ReactNode {
  const [error, setError] = useState<unknown>();
  // turning tokens off stays possible: the server allows it without the feature
  const canSwitchOn = policy.paidEnabled || policy.allowPersonalTokens;

  return (
    <SettingsSection title="API tokens">
      {policy.paidEnabled ? null : (
        <NotEnabledMessage variant="flat">
          {`The API is not enabled for ${orgLogin}.`}
        </NotEnabledMessage>
      )}
      {error ? (
        <ErrorMessage variant="flat">{errorToMessage(error)}</ErrorMessage>
      ) : null}
      <View className="flex-row items-center gap-m">
        <Switch
          checked={policy.allowPersonalTokens}
          disabled={!policy.viewerIsOwner || !canSwitchOn}
          aria-labelledby={labelId}
          onValueChange={(allow) => {
            setError(undefined);
            onSetAllow(allow).catch(setError);
          }}
        />
        <Text nativeID={labelId} className="flex-1 font-body">
          Allow personal API tokens
        </Text>
      </View>
      <Text className="text-sm text-muted">
        {`Members can then read the pull requests of ${orgLogin} from tools like vigie, with a read-only token of their own.`}
      </Text>
      {policy.viewerIsOwner ? null : (
        <Text className="text-sm text-muted">
          {`Only an owner of ${orgLogin} can change this.`}
        </Text>
      )}
    </SettingsSection>
  );
}
