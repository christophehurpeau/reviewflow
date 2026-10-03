import {
  Avatar,
  ExternalLinkButton,
  InfoMessage,
  PressableListItem,
  Text,
  View,
} from "alouette";
import type { ReactNode } from "react";
import type { ResourceResult } from "react-liwi";
import type { OrgSummary } from "reviewflow-modules";
import { ListSection } from "#/components/list-section.tsx";
import { ResourceView } from "#/components/resource-view.tsx";
import { Screen } from "#/components/screen.tsx";
import { SkeletonList } from "#/components/skeleton.tsx";
import { reviewflowName } from "#/reviewflowName.ts";

const installUrl = `https://github.com/apps/${reviewflowName}/installations/new`;

interface SettingsHomeScreenProps {
  userLogin: string;
  orgs: ResourceResult<OrgSummary[], Record<string, never>>;
  onSelectUser: () => void;
  onSelectOrg: (org: OrgSummary) => void;
}

export function SettingsHomeScreen({
  userLogin,
  orgs,
  onSelectUser,
  onSelectOrg,
}: SettingsHomeScreenProps): ReactNode {
  return (
    <Screen title="Settings">
      <View className="gap-l">
        <ListSection title="Your account">
          <PressableListItem onPress={onSelectUser}>
            <View className="flex-row items-center gap-m">
              <Avatar name={userLogin} size="sm" />
              <Text className="font-body-bold">{userLogin}</Text>
            </View>
          </PressableListItem>
        </ListSection>

        <ListSection title="Your organizations">
          <ResourceView resource={orgs} loading={<SkeletonList rows={2} />}>
            {(orgList) =>
              orgList.length === 0 ? (
                <View className="gap-m md:max-w-[560px]">
                  <InfoMessage>
                    No organization yet. Install reviewflow on a github
                    organization to get started.
                  </InfoMessage>
                  <View className="flex-row">
                    <ExternalLinkButton
                      href={installUrl}
                      text={`Install ${reviewflowName}`}
                    />
                  </View>
                </View>
              ) : (
                <View className="gap-xs">
                  {orgList.map((org) => (
                    <PressableListItem
                      key={org._id}
                      onPress={() => {
                        onSelectOrg(org);
                      }}
                    >
                      <View className="flex-row items-center gap-m">
                        <Avatar name={org.login} size="sm" />
                        <Text className="font-body-bold">{org.login}</Text>
                      </View>
                    </PressableListItem>
                  ))}
                </View>
              )
            }
          </ResourceView>
        </ListSection>
      </View>
    </Screen>
  );
}
