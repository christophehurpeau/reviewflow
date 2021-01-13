'use strict';

const octokitRestPkg = require('@octokit/rest/package.json');
const probotPkg = require('probot/package.json');
const semver = require('semver');
const pkg = require('../package.json');

const check = (condition, message) => {
  if (!condition) {
    console.error(message);
    process.exitCode = 1;
  }
};

check(
  semver.satisfies(
    pkg.dependencies['@octokit/core'],
    probotPkg.dependencies['@octokit/core'],
  ),
  `@octokit/core devDependency "${pkg.dependencies['@octokit/core']}" does not satisfies "${probotPkg.dependencies['@octokit/core']}"`,
);

check(
  semver.satisfies(
    pkg.dependencies['@octokit/webhooks'],
    probotPkg.dependencies['@octokit/webhooks'],
  ),
  `@octokit/webhooks devDependency "${pkg.dependencies['@octokit/webhooks']}" does not satisfies "${probotPkg.dependencies['@octokit/webhooks']}"`,
);

console.log(
  octokitRestPkg.dependencies['@octokit/plugin-rest-endpoint-methods'],
  probotPkg.dependencies['@octokit/plugin-rest-endpoint-methods'],
);

check(
  semver.satisfies(
    octokitRestPkg.dependencies['@octokit/plugin-rest-endpoint-methods'],
    probotPkg.dependencies['@octokit/plugin-rest-endpoint-methods'],
  ),
  `@octokit/plugin-rest-endpoint-methods dependency of @octokit/rest "${octokitRestPkg.dependencies['@octokit/plugin-rest-endpoint-methods']}" does not satisfies "${probotPkg.dependencies['@octokit/plugin-rest-endpoint-methods']}"`,
);
