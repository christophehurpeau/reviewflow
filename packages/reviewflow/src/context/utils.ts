import createEmojiRegex from "emoji-regex";

export const getKeys = <T extends object>(o: T): (keyof T)[] =>
  Object.keys(o) as (keyof T)[];

const emojiRegex = createEmojiRegex();

export const getEmojiFromRepoDescription = (
  description: string | null,
): string => {
  if (!description) return "";
  if (description.startsWith(":")) {
    const [, emoji] = /^(:\w+:)/.exec(description) || [];
    return emoji || "";
  }
  const match = emojiRegex.exec(description);
  if (match && description.startsWith(match[0])) return match[0];
  return "";
};
