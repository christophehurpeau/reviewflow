import type { SlackMessage } from "@reviewflow/core";
import type { Block, KnownBlock } from "@slack/web-api";

export const createMrkdwnSectionBlock = (text: string): KnownBlock => ({
  type: "section",
  text: {
    type: "mrkdwn",
    text,
  },
});

export const createSlackMessageWithSecondaryBlock = (
  message: string,
  secondaryBlockTextOrBlocks?: Block[] | KnownBlock[] | string | null,
): SlackMessage => {
  return {
    text: message,
    blocks: [createMrkdwnSectionBlock(message)],
    secondaryBlocks: (() => {
      if (!secondaryBlockTextOrBlocks) return undefined;
      return Array.isArray(secondaryBlockTextOrBlocks)
        ? secondaryBlockTextOrBlocks
        : [createMrkdwnSectionBlock(secondaryBlockTextOrBlocks)];
    })(),
  };
};
