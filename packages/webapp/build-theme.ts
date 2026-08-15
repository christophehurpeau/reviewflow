import type { AccentName, PaletteSpec } from "alouette/theme-generator";
import { writeTheme } from "alouette/theme-generator";

// Hues fitted (in OKLCH) on GitHub Primer's own scales, so reviewflow reads as
// a companion to the GitHub UI it augments: green brand and success, Primer
// blue for info, its slightly pink red, its amber-to-cream yellow ramp, and the
// blue-tinted grays instead of alouette's neutral ones.
const githubPalette: Partial<Record<AccentName, PaletteSpec>> = {
  grayscale: { type: "grayscale", hue: 250, intensity: 0.18 },
  brand: { type: "accent", hue: 148, hueHi: 152 },
  success: { type: "accent", hue: 148, hueHi: 152 },
  danger: { type: "accent", hue: 21, hueHi: 26 },
  info: { type: "accent", hue: 260, hueHi: 242 },
  warning: { type: "brightAccent", hue: 52, hueHi: 99 },
};

writeTheme({ outDir: "src", overrides: githubPalette });
