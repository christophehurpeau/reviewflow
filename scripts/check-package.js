import { createCheckPackage } from "check-package-dependencies";

await createCheckPackage()
  .checkRecommended({
    isLibrary: false,
    onlyWarnsForInDependencies: {
      "@commitlint/config-conventional": {
        duplicateDirectDependency: [
          "conventional-changelog-conventionalcommits",
        ],
      },
    },
  })
  .checkSatisfiesVersionsFromDependency("probot", {
    dependencies: ["@octokit/core", "@octokit/webhooks"],
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
