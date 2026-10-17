# Changelog

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [6.16.1](https://github.com/christophehurpeau/reviewflow/compare/v6.16.0...v6.16.1) (2026-10-17)

### Bug Fixes

* check the slack sign-in token with users.identity

## [6.16.0](https://github.com/christophehurpeau/reviewflow/compare/v6.15.1...v6.16.0) (2026-10-17)

### Features

* add GET /api/health on the bot and webapp servers

Version bump for dependency: reviewflow-core


## [6.15.0](https://github.com/christophehurpeau/reviewflow/compare/v6.14.0...v6.15.0) (2026-10-16)

### Features

* ask to sign in to slack again when the user token was revoked
* **webapp-server:** add GET /api/board/v1 and /api/board-bucket/v1
* **webapp-server:** add GET /api/health/v1
* **webapp-server:** add GET /api/pr/v1/:owner/:repo/:number
* **webapp-server:** add POST /api/prs-lookup/v1
* **webapp-server:** add the read api with personal token auth and GET /api/me/v1
* **webapp-server:** conditional requests on the read api GETs
* **webapp-server:** rate limit the read api per token and failed auth per ip

Version bump for dependency: reviewflow-core
Version bump for dependency: reviewflow-modules


## [6.14.0](https://github.com/christophehurpeau/reviewflow/compare/v6.13.0...v6.14.0) (2026-10-12)

### Features

* add personal api tokens
* let org owners allow personal api tokens

Version bump for dependency: reviewflow-core
Version bump for dependency: reviewflow-modules


## [6.13.0](https://github.com/christophehurpeau/reviewflow/compare/v6.12.0...v6.13.0) (2026-10-12)

### Features

* **deps:** upgrade liwi to 14 and drop the local prs writer

Version bump for dependency: reviewflow-core
Version bump for dependency: reviewflow-modules


## [6.11.0](https://github.com/christophehurpeau/reviewflow/compare/v6.10.0...v6.11.0) (2026-09-24)

### Bug Fixes

* sync org throwed error because of unsupported case in liwi dependency

Version bump for dependency: reviewflow-core
Version bump for dependency: reviewflow-modules


## [6.10.0](https://github.com/christophehurpeau/reviewflow/compare/v6.9.0...v6.10.0) (2026-09-14)

### Features

* prepare for vscode extension

Version bump for dependency: reviewflow-core
Version bump for dependency: reviewflow-modules


## [6.8.4](https://github.com/christophehurpeau/reviewflow/compare/v6.8.3...v6.8.4) (2026-09-11)

### Bug Fixes

* do not start a review twice from one click

Version bump for dependency: reviewflow-core
Version bump for dependency: reviewflow-modules


## [6.8.2](https://github.com/christophehurpeau/reviewflow/compare/v6.8.1...v6.8.2) (2026-09-11)

### Bug Fixes

* add small delay before re-requesting self

## [6.8.0](https://github.com/christophehurpeau/reviewflow/compare/v6.7.0...v6.8.0) (2026-09-11)

### Features

* align and improve dashboard slack and webapp
* enhance PR bucket functionality with new sorting, indexing, and UI improvements
* start review button to avoid multiple review starting on the same team

### Bug Fixes

* **webapp:** ignore pending checks excluded by configuration

Version bump for dependency: reviewflow-core
Version bump for dependency: reviewflow-modules


## [6.7.0](https://github.com/christophehurpeau/reviewflow/compare/v6.6.0...v6.7.0) (2026-08-16)

### Features

* add webapp URL configuration and legacy redirects

## [6.6.0](https://github.com/christophehurpeau/reviewflow/compare/v6.5.0...v6.6.0) (2026-08-15)

### Features

* implement repository deletion and archiving handling

Version bump for dependency: reviewflow-core
Version bump for dependency: reviewflow-modules


## [6.5.0](https://github.com/christophehurpeau/reviewflow/compare/v6.4.0...v6.5.0) (2026-08-15)

### Features

* support accounts instead of organizations in PR queries and filters

Version bump for dependency: reviewflow-core
Version bump for dependency: reviewflow-modules


## [6.4.0](https://github.com/christophehurpeau/reviewflow/compare/v6.3.2...v6.4.0) (2026-08-15)

### Features

* better webapp and split servers

Version bump for dependency: reviewflow-core
Version bump for dependency: reviewflow-modules


