import { MessageCategory } from '../dm/MessageCategory';
import { SlackMessage } from './SlackMessage';

export interface SlackMessageResult {
  ts: string;
  channel: string;
}

export type PostSlackMessageResult = SlackMessageResult | null;

export interface TeamSlack {
  mention: (githubLogin: string) => string;
  postMessage: (
    category: MessageCategory,
    githubId: number,
    githubLogin: string,
    message: SlackMessage,
  ) => Promise<PostSlackMessageResult>;
  updateMessage: (
    ts: string,
    channel: string,
    message: SlackMessage,
  ) => Promise<PostSlackMessageResult>;
  deleteMessage: (ts: string, channel: string) => Promise<void>;
  addReaction: (ts: string, channel: string, name: string) => Promise<void>;
  updateHome: (githubLogin: string) => void;
}
