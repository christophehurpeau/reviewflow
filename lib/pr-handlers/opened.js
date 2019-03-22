'use strict';

const { autoAssignPRToCreator } = require('../actions/autoAssignPRToCreator');
const { editOpenedPR } = require('../actions/editOpenedPR');
const { lintPR } = require('../actions/lintPR');

module.exports = async (repoContext, context) => {
  await Promise.all([
    autoAssignPRToCreator(repoContext, context),
    editOpenedPR(repoContext, context),
    lintPR(repoContext, context),
    repoContext.updateReviewStatus(context, 'dev', {
      add: ['needsReview'],
    }),
  ]);
};
