import {
  AppSidebar,
  AppSidebarAccount,
  ColorModePicker,
  SidebarNav,
  SidebarNavItem,
  SidebarNavSection,
  Switch,
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
import { useDensityPreference } from "#/services/DensityProvider.tsx";

const compactLabelId = "compact-density-label";

/**
 * The desktop chrome: `AppSidebarLayout` shows it from `md`. The color mode
 * and density preferences live in the account menu, the brand row having no
 * room for them. Density is offered here only: the phone's chrome is touch
 * driven, where compact controls fall below the touch target.
 */
export function ReviewflowSidebar(): ReactNode {
  const pathname = usePathname();
  const user = useAuthenticatedUser();
  const { preference, setPreference } = useColorModePreference();
  const { density, setDensity } = useDensityPreference();

  return (
    <AppSidebar
      brand={<ReviewflowBrand />}
      footer={
        <AppSidebarAccount
          name={user.login}
          header={
            <View className="gap-sm">
              <View className="flex-row items-center justify-between gap-sm">
                <Text className="text-sm text-muted">Color mode</Text>
                <ColorModePicker
                  value={preference}
                  onValueChange={setPreference}
                />
              </View>
              <View className="flex-row items-center justify-between gap-sm">
                <Text nativeID={compactLabelId} className="text-sm text-muted">
                  Compact
                </Text>
                <Switch
                  checked={density === "compact"}
                  aria-labelledby={compactLabelId}
                  onValueChange={(compact) => {
                    setDensity(compact ? "compact" : "comfortable");
                  }}
                />
              </View>
            </View>
          }
        >
          <LogOutMenuItem />
        </AppSidebarAccount>
      }
    >
      <SidebarNav aria-label="Sections" value={sectionOf(pathname)}>
        <SidebarNavSection>
          <Link asChild href={prsHref}>
            <SidebarNavItem
              label="Pull requests"
              icon={<GitPullRequestRegularIcon />}
              activeIcon={<GitPullRequestDuotoneIcon />}
            />
          </Link>
          <Link asChild href={settingsHref}>
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
