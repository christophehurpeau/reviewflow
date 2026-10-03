import {
  AppSidebar,
  AppSidebarAccount,
  ColorModePicker,
  SidebarNav,
  SidebarNavItem,
  SidebarNavSection,
  Text,
  View,
} from "alouette";
import {
  GearDuotoneIcon,
  GearRegularIcon,
} from "alouette-icons/phosphor-icons/Gear";
import {
  GitPullRequestDuotoneIcon,
  GitPullRequestRegularIcon,
} from "alouette-icons/phosphor-icons/GitPullRequest";
import { Link, usePathname } from "expo-router";
import type { ReactNode } from "react";
import {
  LogOutMenuItem,
  ReviewflowBrand,
  prsHref,
  sectionOf,
  settingsHref,
} from "#/components/app-chrome.tsx";
import { useAuthenticatedUser } from "#/services/AuthenticatedUserProvider.tsx";
import { useColorModePreference } from "#/services/ColorModeProvider.tsx";

/**
 * The desktop chrome: `AppSidebarLayout` shows it from `md`. The color mode
 * picker lives in the account menu, the brand row having no room for it.
 */
export function ReviewflowSidebar(): ReactNode {
  const pathname = usePathname();
  const user = useAuthenticatedUser();
  const { preference, setPreference } = useColorModePreference();

  return (
    <AppSidebar
      brand={<ReviewflowBrand />}
      footer={
        <AppSidebarAccount
          name={user.login}
          header={
            <View className="flex-row items-center justify-between gap-sm">
              <Text className="text-sm text-muted">Color mode</Text>
              <ColorModePicker
                value={preference}
                onValueChange={setPreference}
              />
            </View>
          }
        >
          <LogOutMenuItem />
        </AppSidebarAccount>
      }
    >
      <SidebarNav aria-label="Sections" value={sectionOf(pathname)}>
        <SidebarNavSection>
          <Link href={prsHref} asChild>
            <SidebarNavItem
              label="Pull requests"
              icon={<GitPullRequestRegularIcon />}
              activeIcon={<GitPullRequestDuotoneIcon />}
            />
          </Link>
          <Link href={settingsHref} asChild>
            <SidebarNavItem
              label="Settings"
              icon={<GearRegularIcon />}
              activeIcon={<GearDuotoneIcon />}
            />
          </Link>
        </SidebarNavSection>
      </SidebarNav>
    </AppSidebar>
  );
}
