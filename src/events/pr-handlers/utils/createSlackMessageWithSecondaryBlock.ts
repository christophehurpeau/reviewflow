import { KnownBlock } from '@slack/web-api';
import { SlackMessage } from '../../../context/SlackMessage';

export const createMrkdwnSectionBlock = (text: string): KnownBlock => ({
  type: 'section' as const,
  text: {
    type: 'mrkdwn' as const,
    text,
  },
});

export const createSlackMessageWithSecondaryBlock = (
  message: string,
  secondaryBlockText?: string,
): SlackMessage => {
  return {
    text: message,
    blocks: [
      {
        type: 'section' as const,
        text: {
          type: 'mrkdwn' as const,
          text: message,
        },
      },
    ],
    secondaryBlocks: !secondaryBlockText
      ? undefined
      : [createMrkdwnSectionBlock(secondaryBlockText)],
  };
};
