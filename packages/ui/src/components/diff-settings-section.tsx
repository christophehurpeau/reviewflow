import type { DiffFont, DiffTheme } from "@reviewflow/sdk";
import {
  diffFontOptions,
  diffThemeOptions,
  isDiffFont,
  isDiffTheme,
} from "@reviewflow/sdk";
import {
  Box,
  ErrorMessage,
  FormItem,
  IndeterminateCircularProgress,
  InputText,
  Select,
  Switch,
  Text,
  View,
  useCurrentMode,
} from "alouette";
import type { ReactNode } from "react";
import { Suspense, lazy, useState } from "react";
import { errorToMessage } from "../services/errorToMessage.ts";
import { diffFontFamily } from "./branch-diff/diff-font.ts";

const DiffThemePreview = lazy(() => import("./diff-theme-preview.tsx"));

export interface DiffDisplaySettings {
  wordWrap: boolean;
  hideWhitespace: boolean;
  theme: DiffTheme;
  font: DiffFont;
  /** the CSS `font-family` of the `custom` font */
  customFont: string;
}

interface DiffSettingsSectionProps {
  settings: DiffDisplaySettings;
  /** saves one change, wherever the app keeps them; a rejection is shown in the section */
  onChange: (change: Partial<DiffDisplaySettings>) => Promise<void>;
}

/**
 * How the diffs render, for an app's settings screen. Saved on the press; the
 * preview follows the picked theme at once rather than waiting for the save.
 */
export function DiffSettingsSection({
  settings,
  onChange,
}: DiffSettingsSectionProps): ReactNode {
  const mode = useCurrentMode();
  const [error, setError] = useState<string | null>(null);
  const [pickedTheme, setPickedTheme] = useState<DiffTheme | null>(null);
  const [pickedFont, setPickedFont] = useState<DiffFont | null>(null);
  const [typedCustomFont, setTypedCustomFont] = useState<string | null>(null);

  const save = (
    change: Partial<DiffDisplaySettings>,
    onSettled?: () => void,
  ): void => {
    setError(null);
    onChange(change)
      .catch((changeError: unknown) => {
        setError(errorToMessage(changeError));
      })
      .finally(onSettled);
  };

  const previewTheme = pickedTheme ?? settings.theme;
  const previewFont = pickedFont ?? settings.font;
  const previewCustomFont = typedCustomFont ?? settings.customFont;

  return (
    <Box className="surface gap-m p-m">
      <Text className="font-heading-bold text-lg">Diff</Text>

      <FormItem
        label="Wrap long lines"
        details="On, a line longer than its column wraps. Off, it stays on one line and the file scrolls sideways."
        render={({ labelId, describedBy }) => (
          <Switch
            aria-labelledby={labelId}
            aria-describedby={describedBy}
            checked={settings.wordWrap}
            onValueChange={(wordWrap) => {
              save({ wordWrap });
            }}
          />
        )}
      />

      <FormItem
        label="Hide whitespace changes"
        details="On, a line whose only change is whitespace is not shown as changed, and a file with nothing else is listed as left out. The diff's toolbar switches it too. A pull request read from GitHub's API shows whitespace whatever this says."
        render={({ labelId, describedBy }) => (
          <Switch
            aria-labelledby={labelId}
            aria-describedby={describedBy}
            checked={settings.hideWhitespace}
            onValueChange={(hideWhitespace) => {
              save({ hideWhitespace });
            }}
          />
        )}
      />

      <FormItem
        label="Theme"
        details="The syntax colours of the diffs. Each theme has a light and a dark variant, following the app's mode."
        render={({ labelId, describedBy }) => (
          <Select
            aria-labelledby={labelId}
            aria-describedby={describedBy}
            options={diffThemeOptions}
            value={previewTheme}
            onValueChange={(theme) => {
              if (!isDiffTheme(theme)) return;
              setPickedTheme(theme);
              save({ theme }, () => {
                setPickedTheme((current) =>
                  current === theme ? null : current,
                );
              });
            }}
          />
        )}
      />

      <FormItem
        label="Font"
        details="The font of the diffs' code: the app's own mono, the system mono font the diff library ships with, or one installed on this machine."
        render={({ labelId, describedBy }) => (
          <Select
            aria-labelledby={labelId}
            aria-describedby={describedBy}
            options={diffFontOptions}
            value={previewFont}
            onValueChange={(font) => {
              if (!isDiffFont(font)) return;
              setPickedFont(font);
              save({ font }, () => {
                setPickedFont((current) => (current === font ? null : current));
              });
            }}
          />
        )}
      />

      {previewFont === "custom" ? (
        <FormItem
          label="Custom font"
          details="A CSS font-family, as installed on this machine: JetBrains Mono, or a list such as “Fira Code”, Menlo. The app's mono stands in for a font this machine does not have."
          render={({ labelId, describedBy }) => (
            <InputText
              value={previewCustomFont}
              aria-labelledby={labelId}
              aria-describedby={describedBy}
              autoComplete="off"
              placeholder="JetBrains Mono"
              onChangeText={(customFont) => {
                setTypedCustomFont(customFont);
                save({ customFont }, () => {
                  setTypedCustomFont((current) =>
                    current === customFont ? null : current,
                  );
                });
              }}
            />
          )}
        />
      ) : null}

      <Suspense
        fallback={
          <View className="items-center py-m">
            <IndeterminateCircularProgress loading />
          </View>
        }
      >
        <DiffThemePreview
          theme={previewTheme}
          fontFamily={diffFontFamily(previewFont, previewCustomFont)}
          themeType={mode}
        />
      </Suspense>

      {error === null ? null : <ErrorMessage>{error}</ErrorMessage>}
    </Box>
  );
}
