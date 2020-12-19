import type { MessageCategory } from './MessageCategory';

export const defaultDmSettings: Record<MessageCategory, boolean> = {
  'pr-review': true,
  'pr-review-follow': true,
  'pr-comment': true,
  'pr-comment-bots': true,
  'pr-comment-follow': true,
  'pr-comment-follow-bots': false,
  'pr-comment-mention': true,
  'pr-comment-thread': true,
  'pr-merge-conflicts': true,
  'issue-comment-mention': true,
};
