import pobConfig, { apply } from "@pob/eslint-config";

export default [
  {
    ignores: [
      "packages/webapp/src/themeVariables.ts",
      "packages/webapp/.storybook/storybook.requires.ts",
    ],
  },
  ...pobConfig.configs.node,
  ...pobConfig.configs.toolsProject,
  ...apply({
    files: ["**/*.test.{js,ts}", "vitest.config.js"],
    configs: [
      {
        settings: {
          "import-x/core-modules": ["vitest"],
        },
      },
    ],
  }),
  {
    files: ["packages/webapp/package.json"],
    rules: {
      "check-package-dependencies/require-direct-peer-dependencies": [
        "error",
        {
          // storybook pins reanimated to an exact patch; the app tracks the
          // newer one expo and renovate give it
          onlyWarnsFor: {
            "@storybook/react-native": ["react-native-reanimated"],
          },
        },
      ],
    },
  },
  {
    files: ["packages/reviewflow/package.json"],
    rules: {
      "check-package-dependencies/satisfies-versions-from-dependencies": [
        "error",
        {
          dependencies: {
            probot: {
              dependencies: [
                "@octokit/core",
                "@octokit/webhooks",
                "@octokit/plugin-rest-endpoint-methods",
              ],
            },
            "@octokit/core": {
              dependencies: ["@octokit/graphql"],
            },
          },
        },
      ],
      "check-package-dependencies/satisfies-versions-between-dependencies": [
        "error",
        {
          dependencies: [
            {
              name: "@octokit/plugin-rest-endpoint-methods",
              from: "probot",
              to: "@octokit/rest",
            },
            {
              name: "@octokit/plugin-paginate-rest",
              from: "probot",
              to: "@octokit/rest",
            },
          ],
        },
      ],
    },
  },
];
