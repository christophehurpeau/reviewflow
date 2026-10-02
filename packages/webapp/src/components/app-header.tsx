import {
  AppHeader,
  AppHeaderAccount,
  AppHeaderActions,
  AppHeaderBrand,
  BrandLogo,
  ColorModePicker,
  ExternalLink,
  HeaderNav,
  HeaderNavItem,
  MenuItem,
  Text,
} from "alouette";
import { ChecksRegularIcon } from "alouette-icons/phosphor-icons/ChecksRegularIcon";
import { SignOutRegularIcon } from "alouette-icons/phosphor-icons/SignOutRegularIcon";
import { Link, usePathname, useRouter } from "expo-router";
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
          brandLogo={<BrandLogo icon={<ChecksRegularIcon />} />}
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
