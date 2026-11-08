import type { Accent } from "alouette";
import { Box, Text, View } from "alouette";
import type { ReactNode } from "react";
import { createContext, use } from "react";
import { CopyableCodeBlock } from "./copyable-code-block.tsx";

/**
 * The lines a review comment's suggestion replaces. Only a thread knows them,
 * so a suggestion rendered anywhere else stays a code block.
 */
export const SuggestionOriginalContext = createContext<string[] | null>(null);

interface ChangeLineProps {
  accent: Accent;
  sign: string;
  text: string;
}

function ChangeLine({ accent, sign, text }: ChangeLineProps): ReactNode {
  return (
    <Box accent={accent} className="flex-row gap-xs bg-highlight-accent px-xs">
      <Text className="select-none font-mono text-xs text-accent">{sign}</Text>
      <Text className="min-w-0 flex-1 select-auto font-mono text-xs text-sharp">
        {text === "" ? " " : text}
      </Text>
    </Box>
  );
}

/** A ```` ```suggestion ```` block, shown as the change it proposes. */
export function SuggestedChange({ value }: { value: string }): ReactNode {
  const original = use(SuggestionOriginalContext);
  if (original === null) {
    return <CopyableCodeBlock size="sm" title="suggestion" text={value} />;
  }
  const suggested = value === "" ? [] : value.split("\n");
  return (
    <View className="gap-xxs">
      <Text className="text-xs text-muted">Suggested change</Text>
      <Box className="lowered overflow-hidden rounded-md py-xxs">
        {original.map((line, index) => (
          <ChangeLine
            key={`-${String(index)}`}
            accent="danger"
            sign="-"
            text={line}
          />
        ))}
        {suggested.map((line, index) => (
          <ChangeLine
            key={`+${String(index)}`}
            accent="success"
            sign="+"
            text={line}
          />
        ))}
      </Box>
    </View>
  );
}
