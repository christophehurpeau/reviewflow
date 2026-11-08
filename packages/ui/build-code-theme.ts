import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import type { ThemeRegistration } from "@pierre/diffs";
import pierreDark from "@pierre/theme/pierre-dark";
import pierreLight from "@pierre/theme/pierre-light";
import type { PaletteSpec } from "alouette/theme-generator";
import { createColorScale, createOklchScale } from "alouette/theme-generator";
import Color from "colorjs.io";
import { reviewflowCodePalette, reviewflowPalette } from "./src/palette.ts";

/*
 * The reviewflow code theme, from the app's palette, for the diff (a shiki
 * theme registered with `@pierre/diffs`) and for CodeMirror (the `--md-tok-*`
 * variables of the editors).
 *
 * The diff theme is Pierre's, recolored. Its chrome (backgrounds, borders,
 * git statuses) takes the palette color nearest to Pierre's: a gray the
 * grayscale step of nearest lightness, a hue the accent of nearest hue at the
 * step of nearest lightness. Its syntax takes a role per rule, read from the
 * color Pierre gives the rule, and each role an ink of the palette, as GitHub
 * assigns them: variables in the text color, strings a deep blue (not green,
 * which an added line's background washes out), constants blue, functions
 * purple, keywords and operators red, types amber.
 */

const palette = { ...reviewflowPalette, ...reviewflowCodePalette };

type Mode = "dark" | "light";

interface Step {
  hex: string;
  lightness: number;
}

interface Scale {
  hue: number;
  steps: Step[];
}

type ScaleName = keyof typeof palette;

type Role =
  | "comment"
  | "constant"
  | "function"
  | "keyword"
  | "muted"
  | "string"
  | "type"
  | "variable";

/** A palette scale and its step in each mode, 1 the lightest in light mode. */
interface Ink {
  scale: ScaleName;
  light: number;
  dark: number;
}

const roleInks: Record<Role, Ink> = {
  comment: { scale: "grayscale", light: 8, dark: 8 },
  muted: { scale: "grayscale", light: 10, dark: 9 },
  variable: { scale: "grayscale", light: 11, dark: 11 },
  keyword: { scale: "danger", light: 8, dark: 8 },
  string: { scale: "info", light: 10, dark: 9 },
  constant: { scale: "info", light: 8, dark: 8 },
  function: { scale: "purple", light: 8, dark: 8 },
  type: { scale: "warning", light: 9, dark: 8 },
};

/**
 * Pierre's light syntax colors, one per kind of token. Its dark theme has the
 * same rules in the same order, so a rule's role is read from the light one.
 * A color missing here fails the build: a Pierre update added a kind.
 */
const roleOfPierreColor: Record<string, Role> = {
  "#737373": "comment",
  "#636363": "muted",
  "#d47628": "variable",
  "#d5512f": "variable",
  "#0a0a0a": "variable",
  "#d32a61": "keyword",
  "#08c0ef": "keyword",
  "#199f43": "string",
  "#17a5af": "string",
  "#16a994": "string",
  "#1ca1c7": "constant",
  "#d5a910": "constant",
  "#d5901c": "constant",
  "#18a46c": "constant",
  "#693acf": "function",
  "#1a85d4": "function",
  "#a631be": "type",
};

/** CodeMirror's token classes (see `src/editor/codeHighlight.ts`) and their role. */
/**
 * Rules appended after Pierre's, where its roles are not GitHub's. Last, they
 * win over a Pierre rule of the same scope, never over a more specific one.
 * Pierre's types rule lists `storage.type`, the scope of `const`, `let` and
 * `function`, after its keywords rule: GitHub reads them as keywords.
 */
const overrideRules: { scope: string[]; role: Role }[] = [
  { scope: ["storage", "storage.type", "storage.modifier"], role: "keyword" },
];

const editorTokenRoles: Record<string, Role> = {
  comment: "comment",
  keyword: "keyword",
  string: "string",
  constant: "constant",
  property: "constant",
  type: "type",
  function: "function",
  invalid: "keyword",
};

const diffThemesFile = "src/components/branch-diff/reviewflow-diff-themes.ts";
const editorColorsFile = "src/editor/code-token-colors.css";

/** Below it, Pierre's color is a gray: Pierre's grays have no chroma at all. */
const grayChroma = 0.04;

const chromeAccents = ["danger", "warning", "success", "info"] as const;

const scaleOf = (spec: PaletteSpec, mode: Mode): Scale => {
  const hexes = createColorScale(spec, mode);
  const oklch = createOklchScale(spec, mode, "srgb");
  return {
    hue: (spec.hue + (spec.hueHi ?? spec.hue)) / 2,
    steps: Object.keys(hexes)
      .toSorted((left, right) => Number(left) - Number(right))
      .map((step) => ({
        hex: hexes[step]!.toLowerCase(),
        lightness: oklch[step]!.lightness,
      })),
  };
};

const hueDistance = (left: number, right: number): number => {
  const distance = Math.abs(left - right) % 360;
  return Math.min(distance, 360 - distance);
};

const nearest = <T>(items: readonly T[], distance: (item: T) => number): T => {
  let best = items[0];
  for (const item of items) {
    if (distance(item) < distance(best)) best = item;
  }
  return best;
};

const nearestByLightness = (steps: Step[], lightness: number): Step =>
  nearest(steps, (step) => Math.abs(step.lightness - lightness));

const inkOf = (role: Role, mode: Mode): string => {
  const ink = roleInks[role];
  return scaleOf(palette[ink.scale], mode).steps[ink[mode] - 1].hex;
};

const roleOf = (pierreLightColor: string): Role => {
  const role = roleOfPierreColor[pierreLightColor.toLowerCase()];
  if (role === undefined) {
    throw new Error(
      `no role for Pierre's syntax color ${pierreLightColor}: add it to roleOfPierreColor`,
    );
  }
  return role;
};

const createChromeMapper = (mode: Mode): ((color: string) => string) => {
  const grays = scaleOf(reviewflowPalette.grayscale, mode).steps;
  const accents = chromeAccents.map((name) =>
    scaleOf(reviewflowPalette[name], mode),
  );
  return (color) => {
    const alpha = color.length === 9 ? color.slice(7) : "";
    const [lightness = 0, chroma = 0, hue = 0] = new Color(color.slice(0, 7))
      .to("oklch")
      .coords.map((coord) => coord ?? 0);
    if (chroma < grayChroma) {
      return nearestByLightness(grays, lightness).hex + alpha;
    }
    const accent = nearest(accents, (scale) => hueDistance(scale.hue, hue));
    return nearestByLightness(accent.steps, lightness).hex + alpha;
  };
};

const isColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value);

const mapValues = <T>(
  record: Record<string, T>,
  mapValue: (value: T, key: string) => T,
): Record<string, T> =>
  Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, mapValue(value, key)]),
  );

const pierreThemes: Record<Mode, ThemeRegistration> = {
  light: pierreLight as ThemeRegistration,
  dark: pierreDark as ThemeRegistration,
};

const recolorSyntax = (
  value: unknown,
  lightValue: unknown,
  mode: Mode,
): unknown => {
  if (isColor(value) && isColor(lightValue)) {
    return inkOf(roleOf(lightValue), mode);
  }
  if (
    typeof value === "object" &&
    value !== null &&
    typeof lightValue === "object" &&
    lightValue !== null
  ) {
    const light = lightValue as Record<string, unknown>;
    return mapValues(value as Record<string, unknown>, (field, key) =>
      recolorSyntax(field, light[key], mode),
    );
  }
  return value;
};

const buildDiffTheme = (mode: Mode): ThemeRegistration => {
  const pierre = pierreThemes[mode];
  const lightRules = pierreThemes.light.tokenColors ?? [];
  const lightSemantic = (pierreThemes.light.semanticTokenColors ??
    {}) as Record<string, unknown>;
  const chrome = createChromeMapper(mode);
  const theme: ThemeRegistration = {
    name: `reviewflow-${mode}`,
    displayName: `Reviewflow ${mode === "light" ? "Light" : "Dark"}`,
    type: mode,
    colors: mapValues(pierre.colors ?? {}, (value) =>
      isColor(value) ? chrome(value) : value,
    ),
    tokenColors: [
      ...(pierre.tokenColors ?? []).map((rule, index) => ({
        ...rule,
        settings: recolorSyntax(
          rule.settings,
          lightRules[index]?.settings,
          mode,
        ) as typeof rule.settings,
      })),
      ...overrideRules.map(({ scope, role }) => ({
        scope,
        settings: { foreground: inkOf(role, mode) },
      })),
    ],
    semanticTokenColors: mapValues(
      (pierre.semanticTokenColors ?? {}) as Record<string, unknown>,
      (value, key) => recolorSyntax(value, lightSemantic[key], mode),
    ) as ThemeRegistration["semanticTokenColors"],
  };
  return theme;
};

const editorTokenVariables = (mode: Mode, indent: string): string =>
  Object.entries(editorTokenRoles)
    .map(([token, role]) => `${indent}--md-tok-${token}: ${inkOf(role, mode)};`)
    .join("\n");

const header =
  "Generated by build-code-theme.ts from the palette in src/palette.ts. DO NOT EDIT.";

const diffThemesSource = `/* ${header} */
import type { ThemeRegistration } from "@pierre/diffs";

export const reviewflowLightTheme: ThemeRegistration = ${JSON.stringify(buildDiffTheme("light"))};

export const reviewflowDarkTheme: ThemeRegistration = ${JSON.stringify(buildDiffTheme("dark"))};
`;

const editorColorsSource = `/* ${header} */
/* The code tokens of the editors, in fences and in the frontmatter's yaml. */

.markdown-editor {
${editorTokenVariables("light", "  ")}
}

.dark .markdown-editor {
${editorTokenVariables("dark", "  ")}
}

/* the "system" preference never sets .dark: the palette resolves it with this
   media query, so the dark tokens are repeated here */
@media (prefers-color-scheme: dark) {
  .system .markdown-editor {
${editorTokenVariables("dark", "    ")}
  }
}
`;

writeFileSync(diffThemesFile, diffThemesSource);
writeFileSync(editorColorsFile, editorColorsSource);
execFileSync(
  "pnpm",
  [
    "--dir",
    "../..",
    "exec",
    "oxfmt",
    `packages/ui/${diffThemesFile}`,
    `packages/ui/${editorColorsFile}`,
  ],
  { stdio: "inherit" },
);
