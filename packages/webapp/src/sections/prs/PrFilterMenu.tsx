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
  /** what the pill says of the value, its option's label otherwise */
  valueLabel?: string;
  onValueChange: (value: string | undefined) => void;
}

/** A pill naming the filter, or its value once set, opening the choices. */
export function PrFilterMenu({
  label,
  allLabel,
  icon,
  options,
  value,
  valueLabel,
  onValueChange,
}: PrFilterMenuProps): ReactNode {
  if (options.length === 0) return null;

  const selectedLabel =
    valueLabel ?? options.find((option) => option.value === value)?.label;

  return (
    <Menu
      label={label}
      align="start"
      render={(triggerProps) => (
        <Button
          text={value === undefined ? label : `${label}: ${selectedLabel}`}
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
