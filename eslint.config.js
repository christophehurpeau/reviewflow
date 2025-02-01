import pobTypescriptConfig, { applyTs } from "@pob/eslint-config-typescript";

const configs = pobTypescriptConfig(import.meta.url).configs;

export default [
  { ignores: ["vite.config.ts"] },
  ...configs.node,
  ...configs.app,
  ...configs.allowUnsafeAsWarn,
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
