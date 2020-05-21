import { Context } from 'probot';
import { contextPr } from '../../context/utils';

export const listReviews = async (context: Context) => {
  const { data: reviews } = await context.github.pulls.listReviews(
    contextPr(context, { per_page: 50 }),
  );
  return reviews;
};
