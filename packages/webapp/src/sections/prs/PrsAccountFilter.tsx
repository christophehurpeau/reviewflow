import { BuildingsRegularIcon } from "alouette-icons/phosphor-icons/Buildings";
import type { ReactNode } from "react";
import { PrFilterMenu } from "./PrFilterMenu.tsx";
import type { PrAccount } from "./prAccounts.ts";

interface PrsAccountFilterProps {
  accounts: PrAccount[];
  selectedAccountLogin: string | undefined;
  onSelectAccountLogin: (accountLogin: string | undefined) => void;
}

export function PrsAccountFilter({
  accounts,
  selectedAccountLogin,
  onSelectAccountLogin,
}: PrsAccountFilterProps): ReactNode {
  if (accounts.length < 2) return null;

  return (
    <PrFilterMenu
      label="Account"
      allLabel="All accounts"
      icon={<BuildingsRegularIcon />}
      options={accounts.map(({ login }) => ({ label: login, value: login }))}
      value={selectedAccountLogin}
      onValueChange={onSelectAccountLogin}
    />
  );
}
