import {
  AppHeader,
  AppHeaderAccount,
  AppHeaderActions,
  AppHeaderBrand,
  BrandLogo,
  ColorModePicker,
  ExternalLink,
  MenuItem,
  NavBar,
  NavBarItem,
  Text,
} from "alouette";
import { GitPullRequestRegularIcon } from "alouette-icons/phosphor-icons/GitPullRequestRegularIcon";
import { SignOutRegularIcon } from "alouette-icons/phosphor-icons/SignOutRegularIcon";
import { usePathname, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useAuthenticatedUser } from "#/services/AuthenticatedUserProvider.tsx";
import { useColorModePreference } from "#/services/ColorModeProvider.tsx";
import { serverUrl } from "#/services/serverUrl.ts";

const prsHref = "/prs";
const settingsHref = "/settings";

/**
 * Every route but the pull requests one — user and org pages included — is
 * reached from the settings section, so it is what the nav marks as current.
 */
const sectionOf = (pathname: string): string =>
  pathname.startsWith(prsHref) ? prsHref : settingsHref;

export function ReviewflowHeader(): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthenticatedUser();
  const { preference, setPreference } = useColorModePreference();

  return (
    <AppHeader
      brand={
        <AppHeaderBrand
          title="reviewflow"
          brandLogo={<BrandLogo icon={<GitPullRequestRegularIcon />} />}
          href="/"
          onPress={(event) => {
            event.preventDefault();
            router.navigate("/");
          }}
        />
      }
      actions={
        <AppHeaderActions>
          <ColorModePicker value={preference} onValueChange={setPreference} />
          <AppHeaderAccount
            name={user.login}
            header={
              <Text className="font-body-bold text-sm">{user.login}</Text>
            }
          >
            {/* logging out clears the session cookie the app itself rides on, so
                it replaces the current page rather than opening a tab beside it */}
            <ExternalLink
              as={MenuItem}
              href={serverUrl("/app/logout")}
              openLinkBehavior={{ native: "linking", web: "targetSelf" }}
              label="Log out"
              icon={<SignOutRegularIcon />}
              accent="danger"
            />
          </AppHeaderAccount>
        </AppHeaderActions>
      }
    >
      <NavBar stretch aria-label="Sections" value={sectionOf(pathname)}>
        <NavBarItem
          href={prsHref}
          label="Pull requests"
          onPress={(event) => {
            event.preventDefault();
            router.navigate(prsHref);
          }}
        />
        <NavBarItem
          href={settingsHref}
          label="Settings"
          onPress={(event) => {
            event.preventDefault();
            router.navigate(settingsHref);
          }}
        />
      </NavBar>
    </AppHeader>
  );
}
