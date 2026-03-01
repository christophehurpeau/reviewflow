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
];
