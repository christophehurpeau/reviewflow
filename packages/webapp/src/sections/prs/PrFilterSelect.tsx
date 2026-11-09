import type { SelectOption } from "alouette";
import { Select, Text, View } from "alouette";
import type { ReactNode } from "react";
import { useId } from "react";

/** cannot be a GitHub login nor an `owner/name`, and `undefined` cannot be a select value */
export const allFilterValue = "__all__";

interface PrFilterSelectProps {
  label: string;
  options: SelectOption[];
  value: string | undefined;
  onValueChange: (value: string | undefined) => void;
}

export function PrFilterSelect({
  label,
  options,
  value,
  onValueChange,
}: PrFilterSelectProps): ReactNode {
  const labelId = useId();

  return (
    <View className="min-w-[160px] flex-1 gap-xs md:max-w-[240px]">
      <Text id={labelId} className="font-body text-sm text-muted">
        {label}
      </Text>
      <Select
        aria-labelledby={labelId}
        options={options}
        value={value ?? allFilterValue}
        onValueChange={(next) => {
          onValueChange(next === allFilterValue ? undefined : next);
        }}
      />
    </View>
  );
}
