import type { MessageCategory } from "../../dm/MessageCategory";
import type { AccountInfo } from "../getOrCreateAccount";
import type { SlackMessage } from "./SlackMessage";

export interface SlackMessageResult {
  ts: string;
  channel: string;
  user: AccountInfo;
}

export type PostSlackMessageResult = SlackMessageResult | null;

export interface TeamSlack {
  mention: (githubLogin: string) => string;
  postMessage: (
    category: MessageCategory,
    toUser: AccountInfo,
    message: SlackMessage,
    forTeamId?: number,
  ) => Promise<PostSlackMessageResult>;
  updateMessage: (
    toUser: AccountInfo,
    ts: string,
    channel: string,
    message: SlackMessage,
  ) => Promise<PostSlackMessageResult>;
  deleteMessage: (
    toUser: AccountInfo,
    ts: string,
    channel: string,
  ) => Promise<void>;
  addReaction: (
    toUser: AccountInfo,
    ts: string,
    channel: string,
    name: string,
  ) => Promise<void>;
  updateHome: (githubLogin: string) => void;
  updateSlackMember: (githubId: number, githubLogin: string) => Promise<void>;
  shouldShowLoginMessage: (githubLogin: string) => boolean;
}
