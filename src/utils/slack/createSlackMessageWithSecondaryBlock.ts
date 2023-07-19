import type { KnownBlock } from '@slack/web-api';
import type { SlackMessage } from '../../context/slack/SlackMessage';

export const createMrkdwnSectionBlock = (text: string): KnownBlock => ({
  type: 'section',
  text: {
    type: 'mrkdwn',
    text,
  },
});

export const createSlackMessageWithSecondaryBlock = (
  message: string,
  secondaryBlockTextOrBlocks?: KnownBlock[] | string | null,
): SlackMessage => {
  return {
    text: message,
    blocks: [createMrkdwnSectionBlock(message)],
    secondaryBlocks: !secondaryBlockTextOrBlocks
      ? undefined
      : Array.isArray(secondaryBlockTextOrBlocks)
      ? secondaryBlockTextOrBlocks
      : [createMrkdwnSectionBlock(secondaryBlockTextOrBlocks)],
  };
};
