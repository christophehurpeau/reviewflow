/**
 * The theme list lives in `@reviewflow/sdk`, which a server can import to
 * validate a stored setting; re-exported here so the ui's imports stay put.
 */
export type { DiffTheme } from "@reviewflow/sdk";
export { diffThemeNames, diffThemeOptions, diffThemes } from "@reviewflow/sdk";
