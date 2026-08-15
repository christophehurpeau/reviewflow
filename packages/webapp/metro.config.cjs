"use strict";

const { withAlouetteConfig } = require("alouette/metro.cjs");
const { getDefaultConfig } = require("expo/metro-config.js");

module.exports = withAlouetteConfig(getDefaultConfig(__dirname));
