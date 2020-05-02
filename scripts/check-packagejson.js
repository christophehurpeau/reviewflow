'use strict';

const semver = require('semver');
const probotPkg = require('probot/package.json');
const pkg = require('../package.json');

const check = (condition, message) => {
  if (!condition) {
    console.error(message);
    process.exitCode = 1;
  }
};

check(
  semver.satisfies(
    pkg.dependencies['@octokit/webhooks'],
    probotPkg.dependencies['@octokit/webhooks'],
  ),
  `@octokit/webhooks devDependency "${pkg.dependencies['@octokit/webhooks']}" does not satisfies "${probotPkg.dependencies['@octokit/webhooks']}"`,
);
