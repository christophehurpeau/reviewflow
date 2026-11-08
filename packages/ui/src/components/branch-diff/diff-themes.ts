import { registerCustomTheme } from "@pierre/diffs";
import type { DiffTheme } from "@reviewflow/sdk";
import { diffThemeNames as sdkDiffThemeNames } from "@reviewflow/sdk";

/**
 * The theme list lives in `@reviewflow/sdk`, which a server can import to
 * validate a stored setting; re-exported here so the ui's imports stay put.
 */
export type { DiffTheme } from "@reviewflow/sdk";
export { diffThemeOptions, diffThemes } from "@reviewflow/sdk";

/**
 * How much of its git color an added or deleted line of the reviewflow theme
 * mixes into the code's background: less than pierre's 12% and 20%, which its
 * saturated palette greens and reds read too dark at.
 */
const reviewflowChangeMix = { light: 10, dark: 16 };

/**
 * For a pierre file's `unsafeCSS`: its added and deleted lines' background.
 * Through the percentages pierre mixes a line with (`--mix-light`,
 * `--mix-dark`), not `--diffs-bg-addition-override`: pierre mixes that one
 * with the background again, as the color it mixes towards.
 */
export const changeBackgroundCSS = (theme: DiffTheme): string =>
  theme === "reviewflow"
    ? `:host [data-line], :host [data-no-newline] { --mix-light: ${String(100 - reviewflowChangeMix.light)}%; --mix-dark: ${String(100 - reviewflowChangeMix.dark)}%; }`
    : "";

let reviewflowThemesRegistered = false;

const registerReviewflowThemes = (): void => {
  if (reviewflowThemesRegistered) return;
  reviewflowThemesRegistered = true;
  registerCustomTheme("reviewflow-light", () =>
    import("./reviewflow-diff-themes.ts").then(
      ({ reviewflowLightTheme }) => reviewflowLightTheme,
    ),
  );
  registerCustomTheme("reviewflow-dark", () =>
    import("./reviewflow-diff-themes.ts").then(
      ({ reviewflowDarkTheme }) => reviewflowDarkTheme,
    ),
  );
};

/**
 * The shiki theme names of `theme`, for `@pierre/diffs`. Registers the
 * reviewflow themes first, which pierre resolves from its own registry: a
 * module import with that side effect could be dropped by a bundler, since
 * this package declares itself free of side effects.
 */
export const diffThemeNames = (
  theme: DiffTheme,
): { light: string; dark: string } => {
  registerReviewflowThemes();
  return sdkDiffThemeNames(theme);
};
