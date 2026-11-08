import { registerCustomTheme } from "@pierre/diffs";
import type { DiffTheme } from "@reviewflow/sdk";
import { diffThemeNames as sdkDiffThemeNames } from "@reviewflow/sdk";

/**
 * The theme list lives in `@reviewflow/sdk`, which a server can import to
 * validate a stored setting; re-exported here so the ui's imports stay put.
 */
export type { DiffTheme } from "@reviewflow/sdk";
export { diffThemeOptions, diffThemes } from "@reviewflow/sdk";

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
