import { HStack, IconButton, NavBar, NavBarItem, Text } from "alouette";
import { ArrowLeftRegularIcon } from "alouette-icons/phosphor-icons/ArrowLeftRegularIcon";
import {
  Slot,
  useLocalSearchParams,
  usePathname,
  useRouter,
} from "expo-router";
import type { ReactNode } from "react";
import { PageContainer } from "#/components/page-container.tsx";
import { OrgProvider } from "#/services/OrgProvider.tsx";

export default function OrgLayout(): ReactNode {
  const { org } = useLocalSearchParams<{ org: string }>();
  const pathname = usePathname();
  const router = useRouter();

  const base = `/org/${org}`;

  return (
    <>
      <PageContainer className="gap-xs pt-l">
        <HStack className="gap-m items-center">
          <IconButton
            icon={<ArrowLeftRegularIcon />}
            variant="contained"
            size="sm"
            aria-label="Back to settings"
            onPress={() => {
              router.navigate("/settings");
            }}
          />
          <Text className="font-heading-extrabold text-3xl xl:text-4xl">
            {org}
          </Text>
        </HStack>
        <HStack className="flex-center">
          <NavBar aria-label="Organization sections" value={pathname}>
            <NavBarItem
              href={base}
              label="Settings"
              onPress={(event) => {
                event.preventDefault();
                router.navigate(`/org/${org}`);
              }}
            />
            <NavBarItem
              href={`${base}/repositories`}
              label="Repositories"
              onPress={(event) => {
                event.preventDefault();
                router.navigate(`/org/${org}/repositories`);
              }}
            />
          </NavBar>
        </HStack>
      </PageContainer>
      <OrgProvider
        orgLogin={org}
        onOrgNotFound={() => {
          router.navigate("/settings");
        }}
      >
        <Slot />
      </OrgProvider>
    </>
  );
}
