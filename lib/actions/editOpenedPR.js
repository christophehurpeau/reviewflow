'use strict';

const cleanTitle = require('../utils/cleanTitle');

exports.editOpenedPR = (repoContext, context) => {
  if (!repoContext.config.trimTitle) return;

  const pr = context.payload.pull_request;
  const title = cleanTitle(pr.title);

  if (pr.title !== title) {
    pr.title = title;
    context.github.issues.update(
      context.issue({
        title,
      })
    );
  }
};
