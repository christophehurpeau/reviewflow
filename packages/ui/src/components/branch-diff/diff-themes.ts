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

const changeBackground = (base: string): string =>
  `light-dark(color-mix(in lab, var(--diffs-bg) ${String(100 - reviewflowChangeMix.light)}%, var(${base})), color-mix(in lab, var(--diffs-bg) ${String(100 - reviewflowChangeMix.dark)}%, var(${base})))`;

/** For a pierre file's `unsafeCSS`: its added and deleted lines' background. */
export const changeBackgroundCSS = (theme: DiffTheme): string =>
  theme === "reviewflow"
    ? `:host { --diffs-bg-addition-override: ${changeBackground("--diffs-addition-base")}; --diffs-bg-deletion-override: ${changeBackground("--diffs-deletion-base")}; }`
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
