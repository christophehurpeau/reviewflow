import { createCheckPackage } from 'check-package-dependencies';

createCheckPackage()
  .checkRecommended({
    isLibrary: false,
  })
  .checkSatisfiesVersionsFromDependency('probot', {
    dependencies: ['@octokit/core', '@octokit/webhooks'],
  })
  .checkSatisfiesVersionsBetweenDependencies('probot', '@octokit/rest', {
    dependencies: [
      '@octokit/plugin-rest-endpoint-methods',
      '@octokit/plugin-paginate-rest',
    ],
  });
