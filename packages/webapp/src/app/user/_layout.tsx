import { Slot } from "expo-router";
import type { ReactNode } from "react";
import { AccountLayout } from "#/components/account-layout.tsx";
import { useAuthenticatedUser } from "#/services/AuthenticatedUserProvider.tsx";

export default function UserLayout(): ReactNode {
  const user = useAuthenticatedUser();

  return (
    <AccountLayout
      title={user.login}
      sections={[
        { label: "Settings", href: "/user" },
        { label: "Repositories", href: "/user/repositories" },
      ]}
    >
      <Slot />
    </AccountLayout>
  );
}
