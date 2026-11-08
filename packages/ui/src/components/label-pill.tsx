import type { PullRequestLabel } from "@reviewflow/sdk";
import { Badge, Text, View, useCurrentMode } from "alouette";
import type { ReactNode } from "react";
import { emojify } from "../services/emojify.ts";

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const rgbOf = (hex: string): Rgb | null => {
  if (!/^[\da-f]{6}$/i.test(hex)) return null;
  const channel = (offset: number): number =>
    Number.parseInt(hex.slice(offset, offset + 2), 16);
  return { r: channel(0), g: channel(2), b: channel(4) };
};

/** Perceived lightness, 0 to 1, with the luma weights of sRGB. */
const lightnessOf = ({ r, g, b }: Rgb): number =>
  (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;

const rgba = ({ r, g, b }: Rgb, alpha: number): string =>
  `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha)})`;

const towardWhite = ({ r, g, b }: Rgb, amount: number): Rgb => ({
  r: Math.round(r + (255 - r) * amount),
  g: Math.round(g + (255 - g) * amount),
  b: Math.round(b + (255 - b) * amount),
});

interface PillColors {
  background: string;
  border: string;
  text: string;
}

/**
 * GitHub's own reading of a label colour: solid with dark or light ink on a
 * light page; tinted with the colour lifted toward white on a dark one, where
 * a solid dark-blue pill would vanish into the ground.
 */
const pillColors = (rgb: Rgb, mode: "dark" | "light"): PillColors => {
  const lightness = lightnessOf(rgb);
  if (mode === "light") {
    return {
      background: rgba(rgb, 1),
      border: lightness > 0.85 ? "rgba(31, 35, 40, 0.15)" : "transparent",
      text: lightness > 0.5 ? "#1f2328" : "#ffffff",
    };
  }
  return {
    background: rgba(rgb, 0.18),
    border: rgba(rgb, 0.3),
    text: rgba(towardWhite(rgb, Math.max(0, 0.6 - lightness)), 1),
  };
};

/**
 * A GitHub label in its repository's colour. The colour is data, read at
 * runtime, so it is the one colour in the app set through `style`: no class
 * can name it. An unreadable colour falls back to a plain badge.
 */
export function LabelPill({ label }: { label: PullRequestLabel }): ReactNode {
  const mode = useCurrentMode();
  const rgb = rgbOf(label.color);
  if (rgb === null) return <Badge accent="info">{emojify(label.name)}</Badge>;
  const colors = pillColors(rgb, mode === "dark" ? "dark" : "light");

  return (
    <View
      className="rounded-full border px-sm py-xxs"
      style={{ backgroundColor: colors.background, borderColor: colors.border }}
    >
      <Text
        className="font-body-bold text-sm"
        style={{ color: colors.text }}
        numberOfLines={1}
      >
        {emojify(label.name)}
      </Text>
    </View>
  );
}
