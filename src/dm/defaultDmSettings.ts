import type { MessageCategory } from './MessageCategory';

export const defaultDmSettings: Record<MessageCategory, boolean> = {
  'pr-lifecycle': true,
  'pr-lifecycle-follow': true,
  'pr-review': true,
  'pr-review-follow': true,
  'pr-comment': true,
  'pr-comment-bots': true,
  'pr-comment-follow': true,
  'pr-comment-follow-bots': false,
  'pr-comment-mention': true,
  'pr-comment-thread': true,
  'pr-merge-conflicts': true,
  'commit-comment': true,
  'commit-comment-bots': true,
  'commit-comment-follow': true,
  'commit-comment-follow-bots': false,
  'commit-comment-mention': true,
  'issue-comment-mention': true,
};
