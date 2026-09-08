"use strict";

const path = require("node:path");
const { generate } = require("@storybook/react-native/scripts/generate");
const { withAlouetteConfig } = require("alouette/metro.cjs");
const { getDefaultConfig } = require("expo/metro-config.js");

// refreshes .storybook/storybook.requires.ts from the globs in main.ts, so a
// new story is picked up by any `expo start` / `expo export`
generate({ configPath: path.resolve(__dirname, "./.storybook") });

const config = withAlouetteConfig(getDefaultConfig(__dirname));

module.exports = {
  ...config,
  resolver: {
    ...config.resolver,
    // storybook ships its esm build under this field; without it the cjs one
    // is picked and fails to parse
    resolverMainFields: ["sbmodern", ...config.resolver.resolverMainFields],
    resolveRequest(context, moduleName, platform) {
      const resolveRequest =
        config.resolver.resolveRequest ?? context.resolveRequest;
      const result = resolveRequest(context, moduleName, platform);

      // keep storybook out of production bundles; the /storybook route is what
      // keeps the story files themselves out
      if (
        process.env.NODE_ENV === "production" &&
        result?.filePath?.includes?.(".storybook/")
      ) {
        return { type: "empty" };
      }

      return result;
    },
  },
};
