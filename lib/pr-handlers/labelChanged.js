'use strict';

const { autoMergeIfPossible } = require('../actions/autoMergeIfPossible');

module.exports = async (repoContext, context) => {
  await repoContext.updateStatusCheckFromLabels(context);
  if (
    context.payload.action === 'labeled' &&
    context.payload.label.id ===
      (repoContext.labels['merge/automerge'] &&
        repoContext.labels['merge/automerge'].id)
  ) {
    await autoMergeIfPossible(repoContext, context, true);
  }
};
