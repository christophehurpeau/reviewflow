import { createCheckPackage } from 'check-package-dependencies';

await createCheckPackage()
  .checkRecommended({
    isLibrary: false,
    onlyWarnsForInDependencies: {
      '@commitlint/config-conventional': {
        duplicateDirectDependency: [
          'conventional-changelog-conventionalcommits',
        ],
      },
    },
  })
  .checkSatisfiesVersionsFromDependency('probot', {
    dependencies: ['@octokit/core', '@octokit/webhooks'],
  })
  .checkSatisfiesVersionsBetweenDependencies('probot', '@octokit/rest', {
    dependencies: [
      '@octokit/plugin-rest-endpoint-methods',
      '@octokit/plugin-paginate-rest',
    ],
  })
  .run();
