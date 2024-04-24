import type { Criteria } from 'liwi-store';
import type { AppContext } from '../../../../context/AppContext';
import type { AccountInfo } from '../../../../context/getOrCreateAccount';
import type { RepoContext } from '../../../../context/repoContext';
import type { SlackMessage } from '../../../../context/slack/SlackMessage';
import type { MessageCategory } from '../../../../dm/MessageCategory';
import type { SlackSentMessage } from '../../../../mongo';
import { ExcludesNullish } from '../../../../utils/Excludes';

interface GetSlackSentMessagesOptions {
  type: SlackSentMessage['type'];
  typeId: SlackSentMessage['typeId'];
  messageId?: SlackSentMessage['messageId'];
}

const createCriteria = (
  repoContext: RepoContext,
  type: SlackSentMessage['type'],
  typeId: SlackSentMessage['typeId'],
  messageId?: SlackSentMessage['typeId'],
  ignoreMarkedAsDone = false,
): Criteria<SlackSentMessage> => {
  const criteria: Criteria<SlackSentMessage> = {
    'account.id': repoContext.accountEmbed.id,
    'account.type': repoContext.accountEmbed.type,
    type,
    typeId,
  };
  if (ignoreMarkedAsDone) {
    criteria.isMarkedAsDone = { $ne: true };
  }
  if (messageId) {
    criteria.messageId = messageId;
  }

  return criteria;
};

interface SendSlackMessageOptions extends GetSlackSentMessagesOptions {
  type: SlackSentMessage['type'];
  messageCategory: MessageCategory;
  message: SlackMessage;
  sendTo: AccountInfo[];
  saveInDb: boolean;
}

export const sendSlackMessage = async (
  appContext: AppContext,
  repoContext: RepoContext,
  {
    type,
    typeId,
    messageId,
    messageCategory,
    message,
    sendTo,
    saveInDb,
  }: SendSlackMessageOptions,
): Promise<void> => {
  if (!repoContext.slack) return;
  const sentMessages = await Promise.all(
    sendTo.map((accountUser) =>
      repoContext.slack.postMessage(messageCategory, accountUser, message),
    ),
  );

  if (saveInDb) {
    const filtered = sentMessages.filter(ExcludesNullish);
    if (filtered.length === 0) return;

    await appContext.mongoStores.slackSentMessages.insertOne({
      account: repoContext.accountEmbed,
      type,
      typeId,
      messageId,
      message,
      sentTo: filtered,
    });
  }
};

export const findSlackSentMessages = (
  appContext: AppContext,
  repoContext: RepoContext,
  { type, typeId, messageId }: GetSlackSentMessagesOptions,
  ignoreMarkedAsDone = false,
): Promise<SlackSentMessage[]> => {
  const criteria = createCriteria(
    repoContext,
    type,
    typeId,
    messageId,
    ignoreMarkedAsDone,
  );
  return appContext.mongoStores.slackSentMessages.findAll(criteria);
};

const internalUpdateSlackSentMessages = async (
  appContext: AppContext,
  repoContext: RepoContext,
  slackSentMessages: SlackSentMessage[],
  { type, typeId, messageId, partialMessage }: UpdateSlackSentMessagesOptions,
): Promise<void> => {
  const criteria = createCriteria(repoContext, type, typeId, messageId);
  const partialMessageKeys = Object.keys(partialMessage);

  await Promise.all([
    ...slackSentMessages.map((sentMessage) => {
      // if the text is identical, do not update
      if (
        partialMessageKeys.length === 1 &&
        partialMessageKeys[0] === 'text' &&
        partialMessage.text === sentMessage.message.text
      ) {
        return undefined;
      }
      return Promise.all(
        sentMessage.sentTo.map(
          (sentTo) =>
            sentTo.user && // legacy
            repoContext.slack.updateMessage(
              sentTo.user,
              sentTo.ts,
              sentTo.channel,
              {
                ...sentMessage.message,
                ...partialMessage,
              },
            ),
        ),
      );
    }),
    appContext.mongoStores.slackSentMessages.partialUpdateMany(criteria, {
      $set: {
        ...(Object.fromEntries(
          Object.entries(partialMessage).map(([key, value]) => [
            `message.${key}`,
            value,
          ]),
        ) as any),
      },
    }),
  ]);
};

interface UpdateSlackSentMessagesOptions extends GetSlackSentMessagesOptions {
  partialMessage: Omit<Partial<SlackSentMessage['message']>, 'threadTs'>;
}

export const updateSlackSentMessages = async (
  appContext: AppContext,
  repoContext: RepoContext,
  options: UpdateSlackSentMessagesOptions,
): Promise<void> => {
  const slackSentMessages = await findSlackSentMessages(
    appContext,
    repoContext,
    {
      type: options.type,
      typeId: options.typeId,
      messageId: options.messageId,
    },
    true,
  );

  if (slackSentMessages.length === 0) return;

  return internalUpdateSlackSentMessages(
    appContext,
    repoContext,
    slackSentMessages,
    options,
  );
};

export const sendOrUpdateSlackMessage = async (
  appContext: AppContext,
  repoContext: RepoContext,
  options: Omit<SendSlackMessageOptions, 'saveInDb'>,
  allowSend = true,
): Promise<void> => {
  const slackSentMessages = await findSlackSentMessages(
    appContext,
    repoContext,
    {
      type: options.type,
      typeId: options.typeId,
      messageId: options.messageId,
    },
    true,
  );

  if (slackSentMessages.length === 0) {
    if (!allowSend) return;
    return sendSlackMessage(appContext, repoContext, {
      ...options,
      saveInDb: true,
    });
  }

  return internalUpdateSlackSentMessages(
    appContext,
    repoContext,
    slackSentMessages,
    {
      type: options.type,
      typeId: options.typeId,
      messageId: options.messageId,
      partialMessage: options.message,
    },
  );
};

export const deleteSlackSentMessages = async (
  appContext: AppContext,
  repoContext: RepoContext,
  { type, typeId, messageId }: GetSlackSentMessagesOptions,
): Promise<void> => {
  const criteria = createCriteria(repoContext, type, typeId, messageId);
  const sentMessages = await findSlackSentMessages(appContext, repoContext, {
    type,
    typeId,
    messageId,
  });
  await Promise.all([
    ...sentMessages.map((sentMessage) =>
      Promise.all(
        sentMessage.sentTo.map(
          (sentTo) =>
            sentTo.user && // legacy
            repoContext.slack.deleteMessage(
              sentTo.user,
              sentTo.ts,
              sentTo.channel,
            ),
        ),
      ),
    ),
    appContext.mongoStores.slackSentMessages.deleteMany(criteria),
  ]);
};

export const markAsDoneSlackSentMessages = async (
  appContext: AppContext,
  repoContext: RepoContext,
  { type, typeId, messageId }: GetSlackSentMessagesOptions,
): Promise<void> => {
  const criteria = createCriteria(repoContext, type, typeId, messageId);
  const sentMessages = await findSlackSentMessages(appContext, repoContext, {
    type,
    typeId,
  });

  if (sentMessages.length === 0) return;

  const slackMessagesNotMarkedAsDone = sentMessages.filter(
    (sentMessage) => !sentMessage.isMarkedAsDone,
  );

  await Promise.all([
    ...slackMessagesNotMarkedAsDone.map((sentMessage) =>
      Promise.all(
        sentMessage.sentTo.map(
          (sentTo) =>
            sentTo.user && // legacy
            repoContext.slack.updateMessage(
              sentTo.user,
              sentTo.ts,
              sentTo.channel,
              {
                ...sentMessage.message,
                text: `~${sentMessage.message.text}~`,
              },
            ),
        ),
      ),
    ),
    appContext.mongoStores.slackSentMessages.partialUpdateMany(criteria, {
      $set: {
        isMarkedAsDone: true,
      },
    }),
  ]);
};

interface AddReactionToSlackSentMessageOptions
  extends GetSlackSentMessagesOptions {
  reaction: string;
}

export const addReactionToSlackSentMessage = async (
  appContext: AppContext,
  repoContext: RepoContext,
  { type, typeId, reaction, messageId }: AddReactionToSlackSentMessageOptions,
): Promise<void> => {
  const sentMessages = await findSlackSentMessages(appContext, repoContext, {
    type,
    typeId,
  });

  if (sentMessages.length === 0) return;

  const slackMessagesWithMissingReaction = sentMessages.filter(
    (sentMessage) => !sentMessage.reactions?.includes(reaction),
  );

  await Promise.all([
    ...slackMessagesWithMissingReaction.map((sentMessage) =>
      Promise.all(
        sentMessage.sentTo.map(
          (sentTo) =>
            sentTo.user && // legacy
            repoContext.slack.addReaction(
              sentTo.user,
              sentTo.ts,
              sentTo.channel,
              reaction,
            ),
        ),
      ),
    ),
    appContext.mongoStores.slackSentMessages.partialUpdateMany(
      createCriteria(repoContext, type, typeId, messageId),
      {
        $addToSet: {
          reactions: reaction,
        },
      },
    ),
  ]);
};
