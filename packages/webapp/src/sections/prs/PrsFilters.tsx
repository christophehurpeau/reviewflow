import type {
  PrChecksFilter,
  PrDraftFilter,
  PrFilterOptions,
  PrFilters,
  PrInactiveFilter,
  PrReviewFilter,
  PrStateFilter,
} from "@reviewflow/modules";
import { hasActivePrFilters, parsePrFilters } from "@reviewflow/modules";
import type { SelectOption } from "alouette";
import { Button, Tab, Tabs, View } from "alouette";
import type { ReactNode } from "react";
import { PrFilterSearch } from "./PrFilterSearch.tsx";
import { PrFilterSelect, allFilterValue } from "./PrFilterSelect.tsx";
import { PrsAccountFilter } from "./PrsAccountFilter.tsx";
import type { PrAccount } from "./prAccounts.ts";

const draftOptions: SelectOption[] = [
  { label: "All", value: allFilterValue },
  { label: "Draft", value: "draft" },
  { label: "Ready for review", value: "ready" },
];

const checksOptions: SelectOption[] = [
  { label: "All", value: allFilterValue },
  { label: "Success", value: "success" },
  { label: "Failed", value: "failed" },
  { label: "None", value: "none" },
];

const reviewOptions: SelectOption[] = [
  { label: "All", value: allFilterValue },
  { label: "Approved", value: "approved" },
  { label: "Changes requested", value: "changesRequested" },
  { label: "Waiting", value: "requested" },
];

const inactiveOptions: SelectOption[] = [
  { label: "All", value: allFilterValue },
  { label: "7 days", value: "7" },
  { label: "14 days", value: "14" },
  { label: "30 days", value: "30" },
];

const toOptions = (allLabel: string, values: string[]): SelectOption[] => [
  { label: allLabel, value: allFilterValue },
  ...values.map((value) => ({ label: value, value })),
];

const toDraftFilter = (value: string | undefined): PrDraftFilter | undefined =>
  parsePrFilters({ draft: value }).draft;

const toChecksFilter = (
  value: string | undefined,
): PrChecksFilter | undefined => parsePrFilters({ checks: value }).checks;

const toReviewFilter = (
  value: string | undefined,
): PrReviewFilter | undefined => parsePrFilters({ review: value }).review;

const toInactiveFilter = (
  value: string | undefined,
): PrInactiveFilter | undefined => parsePrFilters({ inactive: value }).inactive;

interface PrsFiltersProps {
  accounts: PrAccount[];
  selectedAccountLogin: string | undefined;
  state: PrStateFilter;
  filters: PrFilters;
  options: PrFilterOptions;
  onSelectAccountLogin: (accountLogin: string | undefined) => void;
  onStateChange: (state: PrStateFilter) => void;
  onFiltersChange: (filters: PrFilters) => void;
}

export function PrsFilters({
  accounts,
  selectedAccountLogin,
  state,
  filters,
  options,
  onSelectAccountLogin,
  onStateChange,
  onFiltersChange,
}: PrsFiltersProps): ReactNode {
  return (
    <View className="gap-m">
      <Tabs
        aria-label="Pull request state"
        value={state}
        onValueChange={(next) => {
          onStateChange(next === "closed" ? "closed" : "open");
        }}
      >
        <Tab value="open" label="Open" />
        <Tab value="closed" label="Closed" />
      </Tabs>
      <PrFilterSearch
        value={filters.search}
        onChange={(search) => {
          onFiltersChange({ ...filters, search });
        }}
      />
      <View className="flex-row flex-wrap items-end gap-m">
        <PrsAccountFilter
          accounts={accounts}
          selectedAccountLogin={selectedAccountLogin}
          onSelectAccountLogin={onSelectAccountLogin}
        />
        <PrFilterSelect
          label="Repository"
          options={toOptions("All repositories", options.repos)}
          value={filters.repo}
          onValueChange={(repo) => {
            onFiltersChange({ ...filters, repo });
          }}
        />
        <PrFilterSelect
          label="Author"
          options={toOptions("All authors", options.authors)}
          value={filters.author}
          onValueChange={(author) => {
            onFiltersChange({ ...filters, author });
          }}
        />
        <PrFilterSelect
          label="Draft"
          options={draftOptions}
          value={filters.draft}
          onValueChange={(draft) => {
            onFiltersChange({ ...filters, draft: toDraftFilter(draft) });
          }}
        />
        <PrFilterSelect
          label="Checks"
          options={checksOptions}
          value={filters.checks}
          onValueChange={(checks) => {
            onFiltersChange({ ...filters, checks: toChecksFilter(checks) });
          }}
        />
        <PrFilterSelect
          label="Review"
          options={reviewOptions}
          value={filters.review}
          onValueChange={(review) => {
            onFiltersChange({ ...filters, review: toReviewFilter(review) });
          }}
        />
        <PrFilterSelect
          label="Label"
          options={toOptions("All labels", options.labels)}
          value={filters.label}
          onValueChange={(label) => {
            onFiltersChange({ ...filters, label });
          }}
        />
        <PrFilterSelect
          label="Inactive for"
          options={inactiveOptions}
          value={filters.inactive}
          onValueChange={(inactive) => {
            onFiltersChange({
              ...filters,
              inactive: toInactiveFilter(inactive),
            });
          }}
        />
        {hasActivePrFilters(filters) ? (
          <Button
            text="Clear filters"
            variant="soft"
            accent="neutral"
            onPress={() => {
              onFiltersChange({});
            }}
          />
        ) : null}
      </View>
    </View>
  );
}
