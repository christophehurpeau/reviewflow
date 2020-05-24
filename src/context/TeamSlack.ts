import Webhooks from '@octokit/webhooks';
import { Context, Octokit } from 'probot';
import { MessageCategory } from '../dm/MessageCategory';
import { SlackMessage } from './SlackMessage';

export interface SlackMessageResult {
  ts: string;
  channel: string;
}

export type PostSlackMessageResult = SlackMessageResult | null;

export interface TeamSlack {
  mention: (githubLogin: string) => string;
  link: (url: string, text: string) => string;
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
  prLink: <T extends { repository: Webhooks.PayloadRepository }>(
    pr: Octokit.PullsGetResponse,
    context: Context<T>,
  ) => string;
  updateHome: (githubLogin: string) => void;
}
