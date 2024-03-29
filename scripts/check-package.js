import { createCheckPackage } from 'check-package-dependencies';

await createCheckPackage()
  .checkRecommended({
    isLibrary: false,
  })
  .checkSatisfiesVersionsFromDependency('probot', {
    dependencies: ['@octokit/core', '@octokit/webhooks'],
  })
  .checkSatisfiesVersionsBetweenDependencies('@octokit/rest', 'probot', {
    dependencies: [
      '@octokit/plugin-rest-endpoint-methods',
      '@octokit/plugin-paginate-rest',
    ],
  })
  .run();
