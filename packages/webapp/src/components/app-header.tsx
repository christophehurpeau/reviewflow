import {
  AppHeader,
  AppHeaderAccount,
  AppHeaderActions,
  ColorModePicker,
  HeaderNav,
  HeaderNavItem,
  Text,
} from "alouette";
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

/** The phone's chrome: `AppSidebarLayout` shows it below `md` only. */
export function ReviewflowHeader(): ReactNode {
  const pathname = usePathname();
  const user = useAuthenticatedUser();
  const { preference, setPreference } = useColorModePreference();

  return (
    <AppHeader
      brand={<ReviewflowBrand />}
      actions={
        <AppHeaderActions>
          <ColorModePicker value={preference} onValueChange={setPreference} />
          <AppHeaderAccount
            name={user.login}
            header={
              <Text className="font-body-bold text-sm">{user.login}</Text>
            }
          >
            <LogOutMenuItem />
          </AppHeaderAccount>
        </AppHeaderActions>
      }
    >
      <HeaderNav aria-label="Sections" value={sectionOf(pathname)}>
        <Link href={prsHref} asChild>
          <HeaderNavItem label="Pull requests" />
        </Link>
        <Link href={settingsHref} asChild>
          <HeaderNavItem label="Settings" />
        </Link>
      </HeaderNav>
    </AppHeader>
  );
}
