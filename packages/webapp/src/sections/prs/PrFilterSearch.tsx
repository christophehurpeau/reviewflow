import { Icon, InputText, View } from "alouette";
import { MagnifyingGlassRegularIcon } from "alouette-icons/phosphor-icons/MagnifyingGlass";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

const debounceMs = 300;

interface PrFilterSearchProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

export function PrFilterSearch({
  value,
  onChange,
}: PrFilterSearchProps): ReactNode {
  const [text, setText] = useState(value ?? "");
  const [committed, setCommitted] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cancelCommit = (): void => {
    clearTimeout(timer.current);
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
            const search = next.trim() || undefined;
            setCommitted(search);
            onChange(search);
          }, debounceMs);
        }}
      />
    </View>
  );
}
