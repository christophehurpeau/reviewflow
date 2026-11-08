import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import type { ThemeRegistration } from "@pierre/diffs";
import pierreDark from "@pierre/theme/pierre-dark";
import pierreLight from "@pierre/theme/pierre-light";
import type { PaletteSpec } from "alouette/theme-generator";
import { createColorScale, createOklchScale } from "alouette/theme-generator";
import Color from "colorjs.io";
import { reviewflowPalette } from "./src/palette.ts";

/*
 * The reviewflow diff theme: Pierre's light and dark themes, every color
 * replaced by one of the app's palette. A gray takes the grayscale step of
 * nearest lightness; a hue takes the accent (danger, warning, success, info)
 * of nearest hue, at the step of nearest lightness for the editor's chrome
 * and at the text step for syntax, so tokens keep the contrast the app's
 * accented text has.
 */

type Mode = "dark" | "light";

interface Step {
  hex: string;
  lightness: number;
}

interface Scale {
  hue: number;
  steps: Step[];
}

const outFile = "src/components/branch-diff/reviewflow-diff-themes.ts";

/** alouette's accented text: the step its `text-accent` resolves to. */
const textStep = 8;

/**
 * The first grayscale step readable as text on the editor's background: the
 * dark ramp jumps from a border gray (7) to a text gray (8).
 */
const firstTextGrayStep: Record<Mode, number> = { light: 7, dark: 8 };

/** Below it, Pierre's color is a gray: Pierre's grays have no chroma at all. */
const grayChroma = 0.04;

const syntaxAccents = ["danger", "warning", "success", "info"] as const;

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

interface Mapper {
  chrome: (color: string) => string;
  syntax: (color: string) => string;
}

const createMapper = (mode: Mode): Mapper => {
  const grays = scaleOf(reviewflowPalette.grayscale, mode).steps;
  const textGrays = grays.slice(firstTextGrayStep[mode] - 1);
  const accents = syntaxAccents.map((name) =>
    scaleOf(reviewflowPalette[name], mode),
  );

  const map = (
    color: string,
    grayPool: Step[],
    pickStep: (scale: Scale, l: number) => Step,
  ): string => {
    const alpha = color.length === 9 ? color.slice(7) : "";
    const [lightness = 0, chroma = 0, hue = 0] = new Color(color.slice(0, 7))
      .to("oklch")
      .coords.map((coord) => coord ?? 0);
    if (chroma < grayChroma) {
      return nearestByLightness(grayPool, lightness).hex + alpha;
    }
    const accent = nearest(accents, (scale) => hueDistance(scale.hue, hue));
    return pickStep(accent, lightness).hex + alpha;
  };

  return {
    chrome: (color) =>
      map(color, grays, (scale, lightness) =>
        nearestByLightness(scale.steps, lightness),
      ),
    syntax: (color) =>
      map(color, textGrays, (scale) => scale.steps[textStep - 1]),
  };
};

const isColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value);

const mapValues = <T>(
  record: Record<string, T>,
  mapValue: (value: T) => T,
): Record<string, T> =>
  Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, mapValue(value)]),
  );

const mapSettings = (
  settings: Record<string, unknown>,
  mapColor: (color: string) => string,
): Record<string, unknown> =>
  mapValues(settings, (value) => (isColor(value) ? mapColor(value) : value));

const buildTheme = (
  pierre: ThemeRegistration,
  mode: Mode,
): ThemeRegistration => {
  const mapper = createMapper(mode);
  const theme: ThemeRegistration = {
    name: `reviewflow-${mode}`,
    displayName: `Reviewflow ${mode === "light" ? "Light" : "Dark"}`,
    type: mode,
    colors: mapValues(pierre.colors ?? {}, (value) =>
      isColor(value) ? mapper.chrome(value) : value,
    ),
    tokenColors: (pierre.tokenColors ?? []).map((rule) => ({
      ...rule,
      settings: mapSettings(rule.settings, mapper.syntax),
    })),
    semanticTokenColors: mapValues(
      (pierre.semanticTokenColors ?? {}) as Record<string, unknown>,
      (value) => {
        if (isColor(value)) return mapper.syntax(value);
        if (typeof value === "object" && value !== null) {
          return mapSettings(value as Record<string, unknown>, mapper.syntax);
        }
        return value;
      },
    ) as ThemeRegistration["semanticTokenColors"],
  };
  return theme;
};

const source = `/* Generated by build-diff-theme.ts from the palette in src/palette.ts. DO NOT EDIT. */
import type { ThemeRegistration } from "@pierre/diffs";

export const reviewflowLightTheme: ThemeRegistration = ${JSON.stringify(buildTheme(pierreLight as ThemeRegistration, "light"))};

export const reviewflowDarkTheme: ThemeRegistration = ${JSON.stringify(buildTheme(pierreDark as ThemeRegistration, "dark"))};
`;

writeFileSync(outFile, source);
execFileSync(
  "pnpm",
  ["--dir", "../..", "exec", "oxfmt", `packages/ui/${outFile}`],
  {
    stdio: "inherit",
  },
);
