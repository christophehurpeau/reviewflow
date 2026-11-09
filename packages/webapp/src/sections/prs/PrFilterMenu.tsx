import type { SVGIconElement, SelectOption } from "alouette";
import { Button, Menu, MenuItem } from "alouette";
import type { ReactNode } from "react";

interface PrFilterMenuProps {
  label: string;
  /** names the "no filter" row */
  allLabel: string;
  icon: SVGIconElement;
  options: SelectOption[];
  value: string | undefined;
  /** the value says what it filters on: the pill drops the filter's name */
  valueOnly?: boolean;
  onValueChange: (value: string | undefined) => void;
}

/** A pill naming the filter, or its value once set, opening the choices. */
export function PrFilterMenu({
  label,
  allLabel,
  icon,
  options,
  value,
  valueOnly = false,
  onValueChange,
}: PrFilterMenuProps): ReactNode {
  if (options.length === 0) return null;

  const selectedLabel = options.find((option) => option.value === value)?.label;
  const pillText = ((): string | undefined => {
    if (value === undefined) return label;
    return valueOnly ? selectedLabel : `${label}: ${selectedLabel}`;
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
          variant={value === undefined ? "outlined" : "tonal"}
          accent={value === undefined ? "neutral" : "brand"}
          {...triggerProps}
        />
      )}
    >
      <MenuItem
        label={allLabel}
        checked={value === undefined}
        onPress={() => {
          onValueChange(undefined);
        }}
      />
      {options.map((option) => (
        <MenuItem
          key={option.value}
          label={option.label}
          checked={option.value === value}
          onPress={() => {
            onValueChange(option.value);
          }}
        />
      ))}
    </Menu>
  );
}
