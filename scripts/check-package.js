import { createCheckPackage } from "check-package-dependencies";

await createCheckPackage()
  .checkRecommended({
    isLibrary: false,
    onlyWarnsForInDependencies: {},
  })
  .checkSatisfiesVersionsFromDependency("probot", {
    dependencies: [
      "@octokit/core",
      "@octokit/webhooks",
      "@octokit/plugin-rest-endpoint-methods",
    ],
  })
  .checkSatisfiesVersionsBetweenDependencies({
    "@octokit/rest": {
      probot: {
        dependencies: [
          "@octokit/plugin-rest-endpoint-methods",
          "@octokit/plugin-paginate-rest",
        ],
      },
    },
  })
  .run();
