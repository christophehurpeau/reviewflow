# Changelog

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [6.16.0](https://github.com/christophehurpeau/reviewflow/compare/v6.15.1...v6.16.0) (2026-10-17)

### Features

* add GET /api/health on the bot and webapp servers

## [6.15.0](https://github.com/christophehurpeau/reviewflow/compare/v6.14.0...v6.15.0) (2026-10-16)

### Features

* ask to sign in to slack again when the user token was revoked
* **core:** add PrDetail, the read api pull request shape
* record mergeable on prs, reset it when the base branch moves
* **reviewflow:** strike the slack review message once its threads are resolved
* send a slack dm on merge conflict, struck through once resolved
* show unresolved conversations in the status and retry automerge when resolved
* track unresolved review threads on prs
* **webapp-server:** add the read api with personal token auth and GET /api/me/v1

Version bump for dependency: reviewflow-modules


## [6.14.0](https://github.com/christophehurpeau/reviewflow/compare/v6.13.0...v6.14.0) (2026-10-12)

### Features

* add personal api tokens
* let org owners allow personal api tokens

Version bump for dependency: reviewflow-modules


## [6.13.0](https://github.com/christophehurpeau/reviewflow/compare/v6.12.0...v6.13.0) (2026-10-12)

### Features

* **core:** add prs writer with true prev, revision and updated
* **deps:** upgrade liwi to 14 and drop the local prs writer
* **reviewflow:** backfill head, base, head repo and merged on prs
* **reviewflow:** persist headRef, baseRef and headRepoFullName on prs
* **reviewflow:** persist isMerged on prs
* **reviewflow:** persist lastPushedAt and lastReviewSubmittedAt on prs
* **reviewflow:** persist per-reviewer requestedAt and submittedAt on prs
* **reviewflow:** persist reviewState on prs

### Bug Fixes

* **core:** expose init ready promise and tolerate a missing collection
* **core:** include authored prs in owner buckets

Version bump for dependency: reviewflow-modules


## [6.11.0](https://github.com/christophehurpeau/reviewflow/compare/v6.10.0...v6.11.0) (2026-09-24)

### Bug Fixes

* add criteria to exclude PR author from review buckets
* sync org throwed error because of unsupported case in liwi dependency

Version bump for dependency: reviewflow-modules


## [6.10.0](https://github.com/christophehurpeau/reviewflow/compare/v6.9.0...v6.10.0) (2026-09-14)

### Features

* prepare for vscode extension

Version bump for dependency: reviewflow-modules


## [6.8.4](https://github.com/christophehurpeau/reviewflow/compare/v6.8.3...v6.8.4) (2026-09-11)

Version bump for dependency: reviewflow-modules


## [6.8.0](https://github.com/christophehurpeau/reviewflow/compare/v6.7.0...v6.8.0) (2026-09-11)

### Features

* align and improve dashboard slack and webapp
* enhance PR bucket functionality with new sorting, indexing, and UI improvements
* start review button to avoid multiple review starting on the same team

### Bug Fixes

* fixes on urls and missing dates and missing authors/assignees with better harmonized format
* **webapp:** ignore pending checks excluded by configuration

Version bump for dependency: reviewflow-modules


## [6.6.0](https://github.com/christophehurpeau/reviewflow/compare/v6.5.0...v6.6.0) (2026-08-15)

### Features

* implement repository deletion and archiving handling

Version bump for dependency: reviewflow-modules


## [6.5.0](https://github.com/christophehurpeau/reviewflow/compare/v6.4.0...v6.5.0) (2026-08-15)

### Features

* support accounts instead of organizations in PR queries and filters

Version bump for dependency: reviewflow-modules


## [6.4.0](https://github.com/christophehurpeau/reviewflow/compare/v6.3.2...v6.4.0) (2026-08-15)

### Features

* better webapp and split servers

Version bump for dependency: reviewflow-modules


