# Changelog

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [6.31.0](https://github.com/christophehurpeau/reviewflow/compare/v6.30.1...v6.31.0) (2026-11-12)

### Features

* **ui:** show who resolved a review thread

## [6.30.0](https://github.com/christophehurpeau/reviewflow/compare/v6.29.0...v6.30.0) (2026-11-09)

### Features

* filter pull request views and add a closed view ([#1262](https://github.com/christophehurpeau/reviewflow/issues/1262))

## [6.29.0](https://github.com/christophehurpeau/reviewflow/compare/v6.28.0...v6.29.0) (2026-11-09)

### Features

* **app:** show a local branch's merged or closed pull request in the repository list, from reviewflow
* **sdk:** a branch's pull requests in every state, a reused name's older ones left out

### Bug Fixes

* **sdk:** name an ignored directory once before a worktree removal, regenerable ones unread
* **sdk:** read a pending review request as review required in the gh pr query

## [6.27.0](https://github.com/christophehurpeau/reviewflow/compare/v6.26.0...v6.27.0) (2026-11-08)

### Features

* **app:** edit the repositories folder (defaultRepoPath) in settings
* **app:** several repositories folders, autodiscover, cached scan
* **sdk:** read a checkout's branch diff against its default branch
* **sdk:** read the commits and the diff of a local branch that is not checked out
* **sdk:** read worktrees, local branches and open pull requests of a repository
* **sdk:** recent commits, a commit's diff, and pull or push of a checkout
* **sdk:** uncommitted diff scope, pushed commits and branch commit count
* **sdk:** uninterruptible git option for commands that delete files
* **sdk:** worktree removal status, shared refusals and a removal that never forces

### Bug Fixes

* **sdk:** never mark the base branch merged

## [6.25.0](https://github.com/christophehurpeau/reviewflow/compare/v6.24.0...v6.25.0) (2026-11-08)

### Features

* **app:** find checkouts under defaultRepoPath, ~/dev/ by default
* **sdk:** put the root group last in the diff
* **ui:** custom diff font
* **ui:** reviewflow diff theme and alouette mono font, both by default

## [6.24.0](https://github.com/christophehurpeau/reviewflow/compare/v6.23.0...v6.24.0) (2026-11-08)

### Features

* **ui:** fold files changed into the review tab

## [6.23.0](https://github.com/christophehurpeau/reviewflow/compare/v6.22.2...v6.23.0) (2026-11-08)

### Features

* **sdk:** share pr status, board facts and relative date

## [6.22.0](https://github.com/christophehurpeau/reviewflow/compare/v6.21.0...v6.22.0) (2026-11-08)

### Features

* add the local review app

