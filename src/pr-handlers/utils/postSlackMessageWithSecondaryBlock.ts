import { MessageCategory } from '../../dm/MessageCategory';
import { RepoContext } from '../../context/repoContext';

export const postSlackMessageWithSecondaryBlock = (
  repoContext: RepoContext,
  category: MessageCategory,
  userId: number,
  userLogin: string,
  message: string,
  secondaryBlockText?: string,
): ReturnType<RepoContext['slack']['postMessage']> => {
  return repoContext.slack.postMessage(category, userId, userLogin, {
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
      : [
          {
            type: 'section' as const,
            text: {
              type: 'mrkdwn' as const,
              text: secondaryBlockText,
            },
          },
        ],
  });
};
