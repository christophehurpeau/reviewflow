import { Context, Octokit } from 'probot';
import { PullRequestData } from './PullRequestData';

export const createReviewflowComment = <T, U extends PullRequestData>(
  context: Context<T>,
  pr: U,
  body: string,
): Promise<Octokit.IssuesCreateCommentResponse> => {
  return context.github.issues
    .createComment(context.repo({ issue_number: pr.number, body }))
    .then(({ data }) => data);
};

export const getReviewflowCommentById = <T, U extends PullRequestData>(
  context: Context<T>,
  pr: U,
  commentId: number,
): Promise<Octokit.IssuesGetCommentResponse | null> => {
  return context.github.issues
    .getComment(
      context.repo({
        issue_number: pr.number,
        comment_id: commentId,
      }),
    )
    .then(
      ({ data }) => data,
      () => null,
    );
};
