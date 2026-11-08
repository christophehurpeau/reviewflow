/**
 * The diff's syntax theme, as a family: each names a shiki theme for the light
 * mode and one for the dark mode, so the diff follows the app's mode whichever
 * is picked. Plain data, so a server can validate a stored setting against the
 * same list the ui renders.
 */
export const diffThemes = [
  "reviewflow",
  "github",
  "github-high-contrast",
  "pierre",
  "vscode",
  "one",
  "catppuccin",
  "rose-pine",
  "solarized",
  "gruvbox",
  "everforest",
  "kanagawa",
  "vitesse",
  "ayu",
  "material",
  "night-owl",
  "min",
] as const;

export type DiffTheme = (typeof diffThemes)[number];

export const isDiffTheme = (value: unknown): value is DiffTheme =>
  (diffThemes as readonly unknown[]).includes(value);

export const defaultDiffTheme: DiffTheme = "reviewflow";

interface DiffThemeFamily {
  label: string;
  /**
   * shiki theme names, the pierre ones resolved by `@pierre/diffs` itself, the
   * reviewflow ones registered by `@reviewflow/ui`
   */
  themes: { light: string; dark: string };
}

const families: Record<DiffTheme, DiffThemeFamily> = {
  reviewflow: {
    label: "Reviewflow",
    themes: { light: "reviewflow-light", dark: "reviewflow-dark" },
  },
  github: {
    label: "GitHub",
    themes: { light: "github-light-default", dark: "github-dark-default" },
  },
  "github-high-contrast": {
    label: "GitHub high contrast",
    themes: {
      light: "github-light-high-contrast",
      dark: "github-dark-high-contrast",
    },
  },
  pierre: {
    label: "Pierre",
    themes: { light: "pierre-light", dark: "pierre-dark" },
  },
  vscode: {
    label: "VS Code",
    themes: { light: "light-plus", dark: "dark-plus" },
  },
  one: { label: "One", themes: { light: "one-light", dark: "one-dark-pro" } },
  catppuccin: {
    label: "Catppuccin",
    themes: { light: "catppuccin-latte", dark: "catppuccin-mocha" },
  },
  "rose-pine": {
    label: "Rosé Pine",
    themes: { light: "rose-pine-dawn", dark: "rose-pine" },
  },
  solarized: {
    label: "Solarized",
    themes: { light: "solarized-light", dark: "solarized-dark" },
  },
  gruvbox: {
    label: "Gruvbox",
    themes: { light: "gruvbox-light-medium", dark: "gruvbox-dark-medium" },
  },
  everforest: {
    label: "Everforest",
    themes: { light: "everforest-light", dark: "everforest-dark" },
  },
  kanagawa: {
    label: "Kanagawa",
    themes: { light: "kanagawa-lotus", dark: "kanagawa-wave" },
  },
  vitesse: {
    label: "Vitesse",
    themes: { light: "vitesse-light", dark: "vitesse-dark" },
  },
  ayu: { label: "Ayu", themes: { light: "ayu-light", dark: "ayu-dark" } },
  material: {
    label: "Material",
    themes: { light: "material-theme-lighter", dark: "material-theme" },
  },
  "night-owl": {
    label: "Night Owl",
    themes: { light: "night-owl-light", dark: "night-owl" },
  },
  min: { label: "Min", themes: { light: "min-light", dark: "min-dark" } },
};

export const diffThemeNames = (
  theme: DiffTheme,
): { light: string; dark: string } => families[theme].themes;

export const diffThemeOptions = diffThemes.map((theme) => ({
  value: theme,
  label: families[theme].label,
}));

/**
 * The diff's code font: `alouette` is the design system's mono (Chivo Mono),
 * `pierre` the system mono stack `@pierre/diffs` ships with, `custom` a font
 * the user names (a CSS `font-family`, stored apart).
 */
export type DiffFont = "alouette" | "custom" | "pierre";

export const isDiffFont = (value: unknown): value is DiffFont =>
  value === "alouette" || value === "pierre" || value === "custom";

export const defaultDiffFont: DiffFont = "alouette";

export const diffFontOptions: { value: DiffFont; label: string }[] = [
  { value: "alouette", label: "Alouette (Chivo Mono)" },
  { value: "pierre", label: "Pierre (system mono)" },
  { value: "custom", label: "Custom" },
];
