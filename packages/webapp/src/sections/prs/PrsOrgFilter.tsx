import { RadioButton, RadioButtonGroup, Text, VStack } from "alouette";
import type { ReactNode } from "react";
import type { OrgSummary } from "reviewflow-modules";

/** `undefined` cannot be a radio value, so "every org" needs a name of its own. */
const allOrgsValue = "all";

const labelId = "prs-org-filter-label";

interface PrsOrgFilterProps {
  orgs: OrgSummary[];
  selectedOrgLogin: string | undefined;
  onSelectOrgLogin: (orgLogin: string | undefined) => void;
}

export function PrsOrgFilter({
  orgs,
  selectedOrgLogin,
  onSelectOrgLogin,
}: PrsOrgFilterProps): ReactNode {
  if (orgs.length < 2) return null;

  return (
    <VStack className="gap-xs">
      <Text id={labelId} className="font-body text-sm text-muted">
        Organization
      </Text>
      <RadioButtonGroup
        aria-labelledby={labelId}
        value={selectedOrgLogin ?? allOrgsValue}
        onValueChange={(value) => {
          onSelectOrgLogin(value === allOrgsValue ? undefined : value);
        }}
      >
        <RadioButton value={allOrgsValue} label="All organizations" />
        {orgs.map((org) => (
          <RadioButton key={org._id} value={org.login} label={org.login} />
        ))}
      </RadioButtonGroup>
    </VStack>
  );
}
