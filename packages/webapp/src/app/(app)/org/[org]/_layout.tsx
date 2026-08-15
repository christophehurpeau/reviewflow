import { Slot, useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { AccountLayout } from "#/components/account-layout.tsx";
import { OrgProvider } from "#/services/OrgProvider.tsx";

export default function OrgLayout(): ReactNode {
  const { org } = useLocalSearchParams<{ org: string }>();
  const router = useRouter();

  return (
    <AccountLayout
      title={org}
      sections={[
        { label: "Settings", href: `/org/${org}` },
        { label: "Repositories", href: `/org/${org}/repositories` },
      ]}
    >
      <OrgProvider
        orgLogin={org}
        onOrgNotFound={() => {
          router.navigate("/settings");
        }}
      >
        <Slot />
      </OrgProvider>
    </AccountLayout>
  );
}
