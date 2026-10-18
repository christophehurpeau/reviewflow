# Changelog

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [6.21.0](https://github.com/christophehurpeau/reviewflow/compare/v6.20.0...v6.21.0) (2026-10-18)

### Features

* store check run and status details and expose them in the read api

## [6.20.0](https://github.com/christophehurpeau/reviewflow/compare/v6.19.0...v6.20.0) (2026-10-18)

### Features

* expose labels, review comment and body edit dates in the read api

## [6.19.0](https://github.com/christophehurpeau/reviewflow/compare/v6.18.0...v6.19.0) (2026-10-18)

### Features

* store baseSha and expose it in the read api

## [6.18.0](https://github.com/christophehurpeau/reviewflow/compare/v6.17.0...v6.18.0) (2026-10-18)

### Features

* gate live updates and the read API behind per-account paid features

## [6.17.0](https://github.com/christophehurpeau/reviewflow/compare/v6.16.1...v6.17.0) (2026-10-18)

### Features

* record the last conversation comment activity on pull requests
* tell the user when live updates are paused
* tell the user which live subscription limit paused their updates

## [6.15.0](https://github.com/christophehurpeau/reviewflow/compare/v6.14.0...v6.15.0) (2026-10-16)

### Features

* ask to sign in to slack again when the user token was revoked
* **core:** add PrDetail, the read api pull request shape
* **modules:** show unresolved review threads on pull request rows
* record mergeable on prs, reset it when the base branch moves
* track unresolved review threads on prs
* **webapp-server:** add GET /api/board/v1 and /api/board-bucket/v1

## [6.14.0](https://github.com/christophehurpeau/reviewflow/compare/v6.13.0...v6.14.0) (2026-10-12)

### Features

* add personal api tokens
* let org owners allow personal api tokens

## [6.13.0](https://github.com/christophehurpeau/reviewflow/compare/v6.12.0...v6.13.0) (2026-10-12)

### Features

* **deps:** upgrade liwi to 14 and drop the local prs writer

## [6.11.0](https://github.com/christophehurpeau/reviewflow/compare/v6.10.0...v6.11.0) (2026-09-24)

### Bug Fixes

* sync org throwed error because of unsupported case in liwi dependency

## [6.10.0](https://github.com/christophehurpeau/reviewflow/compare/v6.9.0...v6.10.0) (2026-09-14)

### Features

* prepare for vscode extension

## [6.8.4](https://github.com/christophehurpeau/reviewflow/compare/v6.8.3...v6.8.4) (2026-09-11)

### Bug Fixes

* missing creator and add tests

## [6.8.0](https://github.com/christophehurpeau/reviewflow/compare/v6.7.0...v6.8.0) (2026-09-11)

### Features

* align and improve dashboard slack and webapp
* improve slack blocks by reverting some changes and improving others
* start review button to avoid multiple review starting on the same team

### Bug Fixes

* fixes on urls and missing dates and missing authors/assignees with better harmonized format
* **webapp:** ignore pending checks excluded by configuration

## [6.6.0](https://github.com/christophehurpeau/reviewflow/compare/v6.5.0...v6.6.0) (2026-08-15)

### Features

* implement repository deletion and archiving handling

## [6.5.0](https://github.com/christophehurpeau/reviewflow/compare/v6.4.0...v6.5.0) (2026-08-15)

### Features

* support accounts instead of organizations in PR queries and filters

## [6.4.0](https://github.com/christophehurpeau/reviewflow/compare/v6.3.2...v6.4.0) (2026-08-15)

### Features

* better webapp and split servers

