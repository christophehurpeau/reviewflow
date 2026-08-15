import type { SelectOption } from "alouette";
import { Select, Text, VStack } from "alouette";
import type { ReactNode } from "react";
import type { PrAccount } from "./prAccounts.ts";

/** `undefined` cannot be a select value, so "every account" needs one of its own. */
const allAccountsValue = "all";

const labelId = "prs-account-filter-label";

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
    { label: "All accounts", value: allAccountsValue },
    ...accounts.map((account) => ({
      label: account.login,
      value: account.login,
    })),
  ];

  return (
    <VStack className="gap-xs md:max-w-[320px]">
      <Text id={labelId} className="font-body text-sm text-muted">
        Account
      </Text>
      <Select
        aria-labelledby={labelId}
        options={options}
        value={selectedAccountLogin ?? allAccountsValue}
        onValueChange={(value) => {
          onSelectAccountLogin(value === allAccountsValue ? undefined : value);
        }}
      />
    </VStack>
  );
}
