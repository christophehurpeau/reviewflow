'use strict';

const { lintPR } = require('../actions/lintPR');
const { editOpenedPR } = require('../actions/editOpenedPR');

module.exports = async (repoContext, context) => {
  await Promise.all([
    editOpenedPR(repoContext, context),
    lintPR(repoContext, context),
  ]);
};
