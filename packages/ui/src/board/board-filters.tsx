import type {
  BoardChecksFilter,
  BoardDraftFilter,
  BoardFilterOptions,
  BoardFilters,
  BoardInactiveFilter,
  BoardReviewFilter,
} from "@reviewflow/sdk";
import {
  defaultBoardFilters,
  hasActiveBoardFilters,
  withBoardFilterAccount,
} from "@reviewflow/sdk";
import type { SelectOption } from "alouette";
import {
  Button,
  Icon,
  InputText,
  Select,
  Tab,
  Tabs,
  Text,
  View,
} from "alouette";
import { MagnifyingGlassRegularIcon } from "alouette-icons/phosphor-icons/MagnifyingGlass";
import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";

/** cannot be a GitHub login nor an `owner/name`, and `null` cannot be a select value */
const allValue = "__all__";

const draftOptions: SelectOption[] = [
  { label: "All", value: allValue },
  { label: "Draft", value: "draft" },
  { label: "Ready for review", value: "ready" },
];

const checksOptions: SelectOption[] = [
  { label: "All", value: allValue },
  { label: "Success", value: "success" },
  { label: "Failed", value: "failed" },
  { label: "None", value: "none" },
];

const isDraftFilter = (
  value: string | null,
): value is BoardDraftFilter | null =>
  value === null || value === "draft" || value === "ready";

const isChecksFilter = (
  value: string | null,
): value is BoardChecksFilter | null =>
  value === null ||
  value === "success" ||
  value === "failed" ||
  value === "none";

const reviewOptions: SelectOption[] = [
  { label: "All", value: allValue },
  { label: "Approved", value: "approved" },
  { label: "Changes requested", value: "changesRequested" },
  { label: "Waiting", value: "requested" },
];

const inactiveOptions: SelectOption[] = [
  { label: "All", value: allValue },
  { label: "7 days", value: "7" },
  { label: "14 days", value: "14" },
  { label: "30 days", value: "30" },
];

const searchDebounceMs = 300;

const isReviewFilter = (
  value: string | null,
): value is BoardReviewFilter | null =>
  value === null ||
  value === "approved" ||
  value === "changesRequested" ||
  value === "requested";

const isInactiveFilter = (
  value: string | null,
): value is BoardInactiveFilter | null =>
  value === null || value === "7" || value === "14" || value === "30";

const toOptions = (allLabel: string, values: string[]): SelectOption[] => [
  { label: allLabel, value: allValue },
  ...values.map((value) => ({ label: value, value })),
];

interface FilterSelectProps {
  label: string;
  options: SelectOption[];
  value: string | null;
  onChange: (value: string | null) => void;
}

function FilterSelect({
  label,
  options,
  value,
  onChange,
}: FilterSelectProps): ReactNode {
  const labelId = useId();

  return (
    <View className="min-w-[160px] flex-1 gap-xs md:max-w-[240px]">
      <Text id={labelId} className="text-sm text-muted">
        {label}
      </Text>
      <Select
        aria-labelledby={labelId}
        options={options}
        value={value ?? allValue}
        onValueChange={(next) => {
          onChange(next === allValue ? null : next);
        }}
      />
    </View>
  );
}

interface FilterSearchProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

function FilterSearch({ value, onChange }: FilterSearchProps): ReactNode {
  const [text, setText] = useState(value ?? "");
  const [committed, setCommitted] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelCommit = (): void => {
    if (timer.current !== null) clearTimeout(timer.current);
  };
  useEffect(() => cancelCommit, []);

  // the filters can change from outside: "Clear filters", a link
  if (value !== committed) {
    setCommitted(value);
    setText(value ?? "");
  }

  return (
    <View className="md:max-w-[480px]">
      <InputText
        aria-label="Search pull requests"
        placeholder="Search by title, number or branch"
        startSlot={
          <Icon icon={<MagnifyingGlassRegularIcon />} className="text-muted" />
        }
        value={text}
        onChangeText={(next) => {
          setText(next);
          cancelCommit();
          timer.current = setTimeout(() => {
            const search = next.trim() || null;
            setCommitted(search);
            onChange(search);
          }, searchDebounceMs);
        }}
      />
    </View>
  );
}

export interface BoardFiltersBarProps {
  filters: BoardFilters;
  accounts: string[];
  options: BoardFilterOptions;
  onChange: (filters: BoardFilters) => void;
}

/** Open or closed, then what narrows the rows of that view. */
export function BoardFiltersBar({
  filters,
  accounts,
  options,
  onChange,
}: BoardFiltersBarProps): ReactNode {
  return (
    <View className="gap-m">
      <Tabs
        aria-label="Pull request state"
        value={filters.state}
        onValueChange={(state) => {
          onChange({
            ...filters,
            state: state === "closed" ? "closed" : "open",
          });
        }}
      >
        <Tab value="open" label="Open" />
        <Tab value="closed" label="Closed" />
      </Tabs>
      <FilterSearch
        value={filters.search}
        onChange={(search) => {
          onChange({ ...filters, search });
        }}
      />
      <View className="flex-row flex-wrap items-end gap-m">
        {accounts.length > 1 ? (
          <FilterSelect
            label="Account"
            options={toOptions("All accounts", accounts)}
            value={filters.account}
            onChange={(account) => {
              onChange(withBoardFilterAccount(filters, account));
            }}
          />
        ) : null}
        <FilterSelect
          label="Repository"
          options={toOptions("All repositories", options.repos)}
          value={filters.repo}
          onChange={(repo) => {
            onChange({ ...filters, repo });
          }}
        />
        <FilterSelect
          label="Author"
          options={toOptions("All authors", options.authors)}
          value={filters.author}
          onChange={(author) => {
            onChange({ ...filters, author });
          }}
        />
        <FilterSelect
          label="Draft"
          options={draftOptions}
          value={filters.draft}
          onChange={(draft) => {
            if (isDraftFilter(draft)) onChange({ ...filters, draft });
          }}
        />
        <FilterSelect
          label="Checks"
          options={checksOptions}
          value={filters.checks}
          onChange={(checks) => {
            if (isChecksFilter(checks)) onChange({ ...filters, checks });
          }}
        />
        <FilterSelect
          label="Review"
          options={reviewOptions}
          value={filters.review}
          onChange={(review) => {
            if (isReviewFilter(review)) onChange({ ...filters, review });
          }}
        />
        <FilterSelect
          label="Label"
          options={toOptions("All labels", options.labels)}
          value={filters.label}
          onChange={(label) => {
            onChange({ ...filters, label });
          }}
        />
        <FilterSelect
          label="Inactive for"
          options={inactiveOptions}
          value={filters.inactive}
          onChange={(inactive) => {
            if (isInactiveFilter(inactive)) onChange({ ...filters, inactive });
          }}
        />
        {hasActiveBoardFilters(filters) ? (
          <Button
            text="Clear filters"
            variant="soft"
            accent="neutral"
            onPress={() => {
              onChange({ ...defaultBoardFilters, state: filters.state });
            }}
          />
        ) : null}
      </View>
    </View>
  );
}
