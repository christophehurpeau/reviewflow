'use strict';

const { createCheckPackage } = require('check-package-dependencies');

createCheckPackage()
  .checkRecommended({
    isLibrary: false,
    directDuplicateDependenciesOnlyWarnsFor: ['@types/node', 'type-fest'],
  })
  .checkSatisfiesVersionsFromDependency('probot', {
    dependencies: ['@octokit/core', '@octokit/webhooks'],
  })
  .checkSatisfiesVersionsBetweenDependencies('probot', '@octokit/rest', {
    dependencies: ['@octokit/plugin-rest-endpoint-methods'],
  });
