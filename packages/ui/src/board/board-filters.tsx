import type {
  BoardChecksFilter,
  BoardDraftFilter,
  BoardFilterOptions,
  BoardFilters,
  BoardReviewFilter,
} from "@reviewflow/sdk";
import {
  defaultBoardFilters,
  hasActiveBoardFilters,
  withBoardFilterAccount,
} from "@reviewflow/sdk";
import type { SVGIconElement, SelectOption } from "alouette";
import {
  Button,
  Icon,
  InputText,
  Menu,
  MenuItem,
  Tab,
  Tabs,
  View,
} from "alouette";
import { BuildingsRegularIcon } from "alouette-icons/phosphor-icons/Buildings";
import { CheckCircleRegularIcon } from "alouette-icons/phosphor-icons/CheckCircle";
import { EyeRegularIcon } from "alouette-icons/phosphor-icons/Eye";
import { GitBranchRegularIcon } from "alouette-icons/phosphor-icons/GitBranch";
import { MagnifyingGlassRegularIcon } from "alouette-icons/phosphor-icons/MagnifyingGlass";
import { PencilSimpleLineRegularIcon } from "alouette-icons/phosphor-icons/PencilSimpleLine";
import { TagRegularIcon } from "alouette-icons/phosphor-icons/Tag";
import { UserRegularIcon } from "alouette-icons/phosphor-icons/User";
import { XRegularIcon } from "alouette-icons/phosphor-icons/X";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { emojify } from "../services/emojify.ts";

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

const searchDebounceMs = 300;

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

const isReviewFilter = (
  value: string | null,
): value is BoardReviewFilter | null =>
  value === null ||
  value === "approved" ||
  value === "changesRequested" ||
  value === "requested";

const toOptions = (values: string[]): SelectOption[] =>
  values.map((value) => ({ label: value, value }));

/** repositories are offered within an account, which already names their owner */
const toRepoOption = (ownerRepo: string): SelectOption => ({
  label: ownerRepo.slice(ownerRepo.indexOf("/") + 1),
  value: ownerRepo,
});

export interface FilterMenuProps {
  label: string;
  /** names the "no filter" row */
  allLabel: string;
  icon: SVGIconElement;
  options: SelectOption[];
  value: string | null;
  /** the value says what it filters on: the pill drops the filter's name */
  valueOnly?: boolean;
  onChange: (value: string | null) => void;
}

/** A pill naming the filter, or its value once set, opening the choices. */
export function FilterMenu({
  label,
  allLabel,
  icon,
  options,
  value,
  valueOnly = false,
  onChange,
}: FilterMenuProps): ReactNode {
  if (options.length === 0) return null;

  const selectedLabel = options.find((option) => option.value === value)?.label;
  const pillText = ((): string | undefined => {
    if (value === null) return label;
    return valueOnly ? selectedLabel : `${label}: ${String(selectedLabel)}`;
  })();

  return (
    <Menu
      label={label}
      align="start"
      render={(triggerProps) => (
        <Button
          text={pillText}
          icon={icon}
          size="sm"
          variant={value === null ? "outlined" : "tonal"}
          accent={value === null ? "neutral" : "brand"}
          {...triggerProps}
        />
      )}
    >
      <MenuItem
        label={allLabel}
        checked={value === null}
        onPress={() => {
          onChange(null);
        }}
      />
      {options.map((option) => (
        <MenuItem
          key={option.value}
          label={option.label}
          checked={option.value === value}
          onPress={() => {
            onChange(option.value);
          }}
        />
      ))}
    </Menu>
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
    <View className="md:w-[360px]">
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

/** Open or closed and the search on one line, then what narrows the rows as pills. */
export function BoardFiltersBar({
  filters,
  accounts,
  options,
  onChange,
}: BoardFiltersBarProps): ReactNode {
  return (
    <View className="gap-sm">
      <View className="gap-sm md:flex-row md:items-center md:justify-between">
        <View className="flex-row">
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
        </View>
        <FilterSearch
          value={filters.search}
          onChange={(search) => {
            onChange({ ...filters, search });
          }}
        />
      </View>
      <View className="flex-row flex-wrap items-center gap-xs">
        {accounts.length > 1 ? (
          <FilterMenu
            valueOnly
            label="Account"
            allLabel="All accounts"
            icon={<BuildingsRegularIcon />}
            options={toOptions(accounts)}
            value={filters.account}
            onChange={(account) => {
              onChange(withBoardFilterAccount(filters, account));
            }}
          />
        ) : null}
        {filters.account !== null ||
        accounts.length < 2 ||
        filters.repo !== null ? (
          <FilterMenu
            label="Repository"
            allLabel="All repositories"
            icon={<GitBranchRegularIcon />}
            options={options.repos.map(toRepoOption)}
            value={filters.repo}
            onChange={(repo) => {
              onChange({ ...filters, repo });
            }}
          />
        ) : null}
        <FilterMenu
          label="Author"
          allLabel="All authors"
          icon={<UserRegularIcon />}
          options={toOptions(options.authors)}
          value={filters.author}
          onChange={(author) => {
            onChange({ ...filters, author });
          }}
        />
        <FilterMenu
          label="Review"
          allLabel="Any review state"
          icon={<EyeRegularIcon />}
          options={reviewOptions}
          value={filters.review}
          onChange={(review) => {
            if (isReviewFilter(review)) onChange({ ...filters, review });
          }}
        />
        <FilterMenu
          label="Checks"
          allLabel="Any checks"
          icon={<CheckCircleRegularIcon />}
          options={checksOptions}
          value={filters.checks}
          onChange={(checks) => {
            if (isChecksFilter(checks)) onChange({ ...filters, checks });
          }}
        />
        <FilterMenu
          label="Label"
          allLabel="All labels"
          icon={<TagRegularIcon />}
          options={options.labels.map((label) => ({
            label: emojify(label),
            value: label,
          }))}
          value={filters.label}
          onChange={(label) => {
            onChange({ ...filters, label });
          }}
        />
        <FilterMenu
          label="Draft"
          allLabel="Drafts and ready"
          icon={<PencilSimpleLineRegularIcon />}
          options={draftOptions}
          value={filters.draft}
          onChange={(draft) => {
            if (isDraftFilter(draft)) onChange({ ...filters, draft });
          }}
        />
        {hasActiveBoardFilters(filters) ? (
          <Button
            text="Clear"
            icon={<XRegularIcon />}
            size="sm"
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
