import type { Block, KnownBlock } from "@slack/web-api";

export interface SlackMessage {
  text: string;
  blocks?: KnownBlock[];
  secondaryBlocks?: Block[];
  threadTs?: string;
}
