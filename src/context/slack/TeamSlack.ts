import type { MessageCategory } from '../../dm/MessageCategory';
import type { AccountInfo } from '../getOrCreateAccount';
import type { SlackMessage } from './SlackMessage';

export interface SlackMessageResult {
  ts: string;
  channel: string;
}

export type PostSlackMessageResult = SlackMessageResult | null;

export interface TeamSlack {
  mention: (githubLogin: string) => string;
  postMessage: (
    category: MessageCategory,
    toAccount: AccountInfo,
    message: SlackMessage,
  ) => Promise<PostSlackMessageResult>;
  updateMessage: (
    toAccount: AccountInfo,
    ts: string,
    channel: string,
    message: SlackMessage,
  ) => Promise<PostSlackMessageResult>;
  deleteMessage: (
    toAccount: AccountInfo,
    ts: string,
    channel: string,
  ) => Promise<void>;
  addReaction: (
    toAccount: AccountInfo,
    ts: string,
    channel: string,
    name: string,
  ) => Promise<void>;
  updateHome: (githubLogin: string) => void;
  updateSlackMember: (githubId: number, githubLogin: string) => Promise<void>;
  shouldShowLoginMessage: (githubLogin: string) => boolean;
}
