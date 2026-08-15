import createEmojiRegex from "emoji-regex";
import { nameToEmoji } from "gemoji";

export const getKeys = <T extends object>(o: T): (keyof T)[] =>
  Object.keys(o) as (keyof T)[];

const emojiRegex = createEmojiRegex();
const shortcodeRegex = /^:([\w+-]+):/;

export const getEmojiFromRepoDescription = (
  description: string | null,
): string => {
  if (!description) return "";
  if (description.startsWith(":")) {
    const [shortcode] = shortcodeRegex.exec(description) || [];
    return shortcode || "";
  }
  const match = emojiRegex.exec(description);
  if (match && description.startsWith(match[0])) return match[0];
  return "";
};

/** Slack renders `:tada:` itself, anything else needs the unicode character. */
export const emojiToUnicode = (emoji: string | undefined): string => {
  if (!emoji) return "";
  const [, name] = shortcodeRegex.exec(emoji) || [];
  if (!name) return emoji;
  return nameToEmoji[name] ?? "";
};
