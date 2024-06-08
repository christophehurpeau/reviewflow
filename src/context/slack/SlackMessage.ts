import type { KnownBlock } from "@slack/web-api";

export interface SlackMessage {
  text: string;
  blocks?: KnownBlock[];
  secondaryBlocks?: KnownBlock[];
  threadTs?: string;
}
