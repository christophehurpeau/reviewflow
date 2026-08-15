import { ActionButton, Badge, InfoMessage, Text, VStack, View } from "alouette";
import type { ReactNode } from "react";
import type { ResourceResult } from "react-liwi";
import type {
  OrgSettings,
  QueryMyDmSettingsParams,
  QueryOrgSettingsParams,
  UserDmSettingsSummary,
} from "reviewflow-modules";
import { Columns } from "#/components/columns.tsx";
import { DmSettingsList } from "#/components/dm-settings-list.tsx";
import { ResourceView } from "#/components/resource-view.tsx";
import { Screen } from "#/components/screen.tsx";
import { SettingsSection } from "#/components/settings-section.tsx";
import { SkeletonSections } from "#/components/skeleton.tsx";
import { SlackConnectionCard } from "#/components/slack-connection-card.tsx";
import { TeamSilenceList } from "#/components/team-silence-list.tsx";
import { errorToMessage } from "#/errorToMessage.ts";

const configRepoUrl =
  "https://github.com/christophehurpeau/reviewflow/blob/master/packages/reviewflow/src/accountConfigs";

type DmSettingsResource = ResourceResult<
  UserDmSettingsSummary | undefined,
  QueryMyDmSettingsParams
>;

interface DmSettingsSectionsProps {
  orgSettings: OrgSettings;
  dmSettings: DmSettingsResource;
}

function DmSettingsSections({
  orgSettings,
  dmSettings,
}: DmSettingsSectionsProps): ReactNode {
  if (orgSettings.slack.state !== "linked") {
    return (
      <InfoMessage>Link your slack account to unlock DM settings.</InfoMessage>
    );
  }

  return (
    <ResourceView
      resource={dmSettings}
      loading={<SkeletonSections sections={1} />}
    >
      {(userDmSettings) => (
        <Columns>
          <SettingsSection title="My DM settings">
            <DmSettingsList
              orgId={orgSettings.orgId}
              defaultDmSettings={orgSettings.defaultDmSettings}
              settings={userDmSettings?.settings ?? {}}
            />
          </SettingsSection>

          {orgSettings.githubTeams.length > 0 ? (
            <SettingsSection title="My DM settings - github teams">
              <TeamSilenceList
                orgId={orgSettings.orgId}
                teams={orgSettings.githubTeams}
                silentTeamIds={userDmSettings?.silentTeamIds ?? []}
              />
            </SettingsSection>
          ) : null}
        </Columns>
      )}
    </ResourceView>
  );
}

interface OrgSettingsContentProps {
  orgSettings: OrgSettings;
  dmSettings: DmSettingsResource;
  onForceSync: () => Promise<void>;
}

function OrgSettingsContent({
  orgSettings,
  dmSettings,
  onForceSync,
}: OrgSettingsContentProps): ReactNode {
  return (
    <VStack className="gap-l">
      <Columns>
        <SettingsSection title="Account config">
          <Badge variant="solid.enabled">
            {orgSettings.hasCustomAccountConfig ? "custom" : "default"}
          </Badge>
          <View>
            <Text className="font-mono text-sm text-muted">
              {orgSettings.hasCustomAccountConfig
                ? `${configRepoUrl}/${orgSettings.login}.ts`
                : `${configRepoUrl}/defaultConfig.ts`}
            </Text>
          </View>
          <ActionButton
            text="Force sync"
            size="sm"
            onPress={onForceSync}
            errorToMessage={errorToMessage}
          />
        </SettingsSection>

        <SettingsSection title="Slack connection">
          <SlackConnectionCard
            orgId={orgSettings.orgId}
            orgLogin={orgSettings.login}
            slack={orgSettings.slack}
          />
        </SettingsSection>

        <SettingsSection title="Your teams">
          <Text className="font-body text-muted">
            {orgSettings.configTeamNames.length > 0
              ? `Config teams: ${orgSettings.configTeamNames.join(", ")}`
              : "No config team"}
          </Text>
          <Text className="font-body text-muted">
            {orgSettings.githubTeams.length > 0
              ? `Github teams: ${orgSettings.githubTeams.map((team) => team.name).join(", ")}`
              : "No github team"}
          </Text>
        </SettingsSection>
      </Columns>

      <DmSettingsSections orgSettings={orgSettings} dmSettings={dmSettings} />
    </VStack>
  );
}

interface OrgSettingsScreenProps {
  orgLogin: string;
  settings: ResourceResult<OrgSettings | undefined, QueryOrgSettingsParams>;
  dmSettings: DmSettingsResource;
  onForceSync: () => Promise<void>;
}

export function OrgSettingsScreen({
  orgLogin,
  settings,
  dmSettings,
  onForceSync,
}: OrgSettingsScreenProps): ReactNode {
  return (
    <Screen title="">
      <ResourceView
        resource={settings}
        loading={<SkeletonSections sections={4} />}
      >
        {(orgSettings) =>
          orgSettings ? (
            <OrgSettingsContent
              orgSettings={orgSettings}
              dmSettings={dmSettings}
              onForceSync={onForceSync}
            />
          ) : (
            <InfoMessage>
              {`Reviewflow has no settings for ${orgLogin} yet.`}
            </InfoMessage>
          )
        }
      </ResourceView>
    </Screen>
  );
}
