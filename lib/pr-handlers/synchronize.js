'use strict';

const { editOpenedPR } = require('../actions/editOpenedPR');

module.exports = async (repoContext, context) => {
  await Promise.all([
    editOpenedPR(repoContext, context),
    repoContext.addStatusCheckToLatestCommit(context),
  ]);
};
