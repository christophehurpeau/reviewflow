import pobConfig, { apply, applyTs } from "@pob/eslint-config";

const configs = pobConfig(import.meta.url).configs;

export default [
  { ignores: ["vite.config.ts"] },
  ...configs.node,
  ...configs.app,
  ...configs.allowUnsafeAsWarn,
  ...apply({
    configs: [
      { rules: { "unicorn/require-post-message-target-origin": "off" } },
    ],
  }),
  ...applyTs({
    configs: [
      {
        rules: {
          camelcase: "off",
          "@typescript-eslint/restrict-template-expressions": "warn",
          "@typescript-eslint/no-floating-promises": "warn",
          "@typescript-eslint/no-deprecated": "warn",
          "unicorn/require-post-message-target-origin": "off",
        },
      },
    ],
  }),
  ...configs.checkPackages,
  {
    settings: {
      "check-package-dependencies": {
        library: false,
      },
    },
  },
  {
    files: ["package.json"],
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
