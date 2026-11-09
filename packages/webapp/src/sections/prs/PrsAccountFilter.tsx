import type { SelectOption } from "alouette";
import type { ReactNode } from "react";
import { PrFilterSelect, allFilterValue } from "./PrFilterSelect.tsx";
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

  const options: SelectOption[] = [
    { label: "All accounts", value: allFilterValue },
    ...accounts.map((account) => ({
      label: account.login,
      value: account.login,
    })),
  ];

  return (
    <PrFilterSelect
      label="Account"
      options={options}
      value={selectedAccountLogin}
      onValueChange={onSelectAccountLogin}
    />
  );
}
