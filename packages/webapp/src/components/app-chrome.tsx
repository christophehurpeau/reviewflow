import { AppHeaderBrand, BrandLogo, ExternalLink, MenuItem } from "alouette";
import { ChecksRegularIcon } from "alouette-icons/phosphor-icons/Checks";
import { SignOutRegularIcon } from "alouette-icons/phosphor-icons/SignOut";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { serverUrl } from "#/services/serverUrl.ts";

export const prsHref = "/prs";
export const settingsHref = "/settings";

/**
 * Every route but the pull requests one — user and org pages included — is
 * reached from the settings section, so it is what the nav marks as current.
 */
export const sectionOf = (pathname: string): string =>
  pathname.startsWith(prsHref) ? prsHref : settingsHref;

export function ReviewflowBrand(): ReactNode {
  const router = useRouter();

  return (
    <AppHeaderBrand
      title="reviewflow"
      brandLogo={<BrandLogo icon={<ChecksRegularIcon />} />}
      href="/"
      onPress={(event) => {
        event.preventDefault();
        router.navigate("/");
      }}
    />
  );
}

/**
 * Logging out clears the session cookie the app itself rides on, so it
 * replaces the current page rather than opening a tab beside it.
 */
export function LogOutMenuItem(): ReactNode {
  return (
    <ExternalLink
      as={MenuItem}
      href={serverUrl("/app/logout")}
      openLinkBehavior={{ native: "linking", web: "targetSelf" }}
      label="Log out"
      icon={<SignOutRegularIcon />}
      accent="danger"
    />
  );
}
