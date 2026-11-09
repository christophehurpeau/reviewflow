import type {
  PrChecksFilter,
  PrDraftFilter,
  PrFilterOptions,
  PrFilters,
  PrReviewFilter,
  PrStateFilter,
} from "@reviewflow/modules";
import { hasActivePrFilters, parsePrFilters } from "@reviewflow/modules";
import type { SelectOption } from "alouette";
import { Button, Tab, Tabs, View } from "alouette";
import { BookBookmarkRegularIcon } from "alouette-icons/phosphor-icons/BookBookmark";
import { CheckCircleRegularIcon } from "alouette-icons/phosphor-icons/CheckCircle";
import { EyeRegularIcon } from "alouette-icons/phosphor-icons/Eye";
import { PencilSimpleLineRegularIcon } from "alouette-icons/phosphor-icons/PencilSimpleLine";
import { TagRegularIcon } from "alouette-icons/phosphor-icons/Tag";
import { UserRegularIcon } from "alouette-icons/phosphor-icons/User";
import { XRegularIcon } from "alouette-icons/phosphor-icons/X";
import type { ReactNode } from "react";
import { emojify } from "#/services/emojify.ts";
import { PrFilterMenu } from "./PrFilterMenu.tsx";
import { PrFilterSearch } from "./PrFilterSearch.tsx";
import { PrsAccountFilter } from "./PrsAccountFilter.tsx";
import type { PrAccount } from "./prAccounts.ts";

const draftOptions: SelectOption[] = [
  { label: "Draft", value: "draft" },
  { label: "Ready for review", value: "ready" },
];

const checksOptions: SelectOption[] = [
  { label: "Success", value: "success" },
  { label: "Failed", value: "failed" },
  { label: "None", value: "none" },
];

const reviewOptions: SelectOption[] = [
  { label: "Approved", value: "approved" },
  { label: "Needs changes", value: "changesRequested" },
  { label: "Waiting", value: "requested" },
];

const toOptions = (values: string[]): SelectOption[] =>
  values.map((value) => ({ label: value, value }));

/** repositories are offered within an account, which already names their owner */
const toRepoOption = (ownerRepo: string): SelectOption => ({
  label: ownerRepo.slice(ownerRepo.indexOf("/") + 1),
  value: ownerRepo,
});

const toDraftFilter = (value: string | undefined): PrDraftFilter | undefined =>
  parsePrFilters({ draft: value }).draft;

const toChecksFilter = (
  value: string | undefined,
): PrChecksFilter | undefined => parsePrFilters({ checks: value }).checks;

const toReviewFilter = (
  value: string | undefined,
): PrReviewFilter | undefined => parsePrFilters({ review: value }).review;

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
    <View className="gap-sm">
      <View className="gap-sm md:flex-row md:items-center md:justify-between">
        <View className="flex-row">
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
        </View>
        <PrFilterSearch
          value={filters.search}
          onChange={(search) => {
            onFiltersChange({ ...filters, search });
          }}
        />
      </View>
      <View className="flex-row flex-wrap items-center gap-xs">
        <PrsAccountFilter
          accounts={accounts}
          selectedAccountLogin={selectedAccountLogin}
          onSelectAccountLogin={onSelectAccountLogin}
        />
        {selectedAccountLogin !== undefined ||
        accounts.length < 2 ||
        filters.repo !== undefined ? (
          <PrFilterMenu
            label="Repository"
            allLabel="All repositories"
            icon={<BookBookmarkRegularIcon />}
            options={options.repos.map(toRepoOption)}
            value={filters.repo}
            onValueChange={(repo) => {
              onFiltersChange({ ...filters, repo });
            }}
          />
        ) : null}
        <PrFilterMenu
          label="Author"
          allLabel="All authors"
          icon={<UserRegularIcon />}
          options={toOptions(options.authors)}
          value={filters.author}
          onValueChange={(author) => {
            onFiltersChange({ ...filters, author });
          }}
        />
        <PrFilterMenu
          label="Review"
          allLabel="Any review state"
          icon={<EyeRegularIcon />}
          options={reviewOptions}
          value={filters.review}
          onValueChange={(review) => {
            onFiltersChange({ ...filters, review: toReviewFilter(review) });
          }}
        />
        <PrFilterMenu
          label="Checks"
          allLabel="Any checks"
          icon={<CheckCircleRegularIcon />}
          options={checksOptions}
          value={filters.checks}
          onValueChange={(checks) => {
            onFiltersChange({ ...filters, checks: toChecksFilter(checks) });
          }}
        />
        <PrFilterMenu
          label="Label"
          allLabel="All labels"
          icon={<TagRegularIcon />}
          options={options.labels.map((label) => ({
            label: emojify(label),
            value: label,
          }))}
          value={filters.label}
          onValueChange={(label) => {
            onFiltersChange({ ...filters, label });
          }}
        />
        <PrFilterMenu
          label="Draft"
          allLabel="Drafts and ready"
          icon={<PencilSimpleLineRegularIcon />}
          options={draftOptions}
          value={filters.draft}
          onValueChange={(draft) => {
            onFiltersChange({ ...filters, draft: toDraftFilter(draft) });
          }}
        />
        {hasActivePrFilters(filters) ? (
          <Button
            text="Clear"
            icon={<XRegularIcon />}
            size="sm"
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
