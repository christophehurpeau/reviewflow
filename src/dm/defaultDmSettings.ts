import { MessageCategory } from './MessageCategory';

export const defaultDmSettings: Record<MessageCategory, boolean> = {
  'pr-review': true,
  'pr-review-follow': true,
  'pr-comment': true,
  'pr-comment-follow': true,
  'pr-comment-mention': true,
  'pr-comment-thread': true,
  'pr-merge-conflicts': true,
  'issue-comment-mention': true,
};
