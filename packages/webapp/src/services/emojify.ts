import { nameToEmoji } from "gemoji";

const shortcode = /:([\w+-]+):/g;

/**
 * GitHub's `:green_heart:` shortcodes as the emoji GitHub renders them as, with
 * the same table reviewflow reads (`gemoji`). An unknown name stays as typed.
 */
export const emojify = (text: string): string =>
  text.replaceAll(
    shortcode,
    (match, name: string) => nameToEmoji[name] ?? match,
  );
