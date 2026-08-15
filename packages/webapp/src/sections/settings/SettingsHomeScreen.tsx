import {
  ExternalLinkButton,
  HStack,
  InfoMessage,
  PressableListItem,
  Text,
  VStack,
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
      <VStack className="gap-l">
        <ListSection title="Your account">
          <PressableListItem onPress={onSelectUser}>
            <Text className="font-body-bold">{userLogin}</Text>
          </PressableListItem>
        </ListSection>

        <ListSection title="Your organizations">
          <ResourceView resource={orgs} loading={<SkeletonList rows={2} />}>
            {(orgList) =>
              orgList.length === 0 ? (
                <VStack className="gap-m md:max-w-[560px]">
                  <InfoMessage>
                    No organization yet. Install reviewflow on a github
                    organization to get started.
                  </InfoMessage>
                  <HStack>
                    <ExternalLinkButton
                      href={installUrl}
                      text={`Install ${reviewflowName}`}
                    />
                  </HStack>
                </VStack>
              ) : (
                <VStack>
                  {orgList.map((org) => (
                    <PressableListItem
                      key={org._id}
                      onPress={() => {
                        onSelectOrg(org);
                      }}
                    >
                      <Text className="font-body-bold">{org.login}</Text>
                    </PressableListItem>
                  ))}
                </VStack>
              )
            }
          </ResourceView>
        </ListSection>
      </VStack>
    </Screen>
  );
}
