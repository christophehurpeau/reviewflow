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
  secondaryBlockText?: string | null,
): SlackMessage => {
  return {
    text: message,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: message,
        },
      },
    ],
    secondaryBlocks: !secondaryBlockText
      ? undefined
      : [createMrkdwnSectionBlock(secondaryBlockText)],
  };
};
