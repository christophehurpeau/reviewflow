# Changelog

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [6.30.1](https://github.com/christophehurpeau/reviewflow/compare/v6.30.0...v6.30.1) (2026-11-09)

### Bug Fixes

* **ui:** lay out the commit message fields full width in the merge and suggestion dialogs ([#1263](https://github.com/christophehurpeau/reviewflow/issues/1263))

## [6.30.0](https://github.com/christophehurpeau/reviewflow/compare/v6.29.0...v6.30.0) (2026-11-09)

### Features

* **app:** run on linux ([#1256](https://github.com/christophehurpeau/reviewflow/issues/1256))
* filter pull request views and add a closed view ([#1262](https://github.com/christophehurpeau/reviewflow/issues/1262))

## [6.29.0](https://github.com/christophehurpeau/reviewflow/compare/v6.28.0...v6.29.0) (2026-11-09)

### Features

* **app:** show a branch's pull requests, merged ones included, on the branch and checkout screens
* **app:** show a local branch's merged or closed pull request in the repository list, from reviewflow
* **sdk:** a branch's pull requests in every state, a reused name's older ones left out
* **ui:** branch pull request buttons, merged and closed ones included
* **ui:** say when commit by commit is turned on by default

### Bug Fixes

* **deps:** update dependency @lezer/highlight to v1.2.5 ([#1254](https://github.com/christophehurpeau/reviewflow/issues/1254))
* read open pull requests' fullDatabaseId and never return a partial list
* **reviewflow:** log a pull request lock with the event that takes it
* **reviewflow:** run a reschedule with the event that scheduled it
* **reviewflow:** store closed the pull requests github sent no closed webhook for
* **reviewflow:** update excluded repository names in PR title parsing
* **sdk:** name an ignored directory once before a worktree removal, regenerable ones unread
* **sdk:** read a pending review request as review required in the gh pr query
* **ui:** never render another range's diff under the commit stepped to

## [6.28.0](https://github.com/christophehurpeau/reviewflow/compare/v6.27.0...v6.28.0) (2026-11-08)

### Features

* **ui:** wording props on the worktree removal button, export formatDataAge

## [6.27.0](https://github.com/christophehurpeau/reviewflow/compare/v6.26.0...v6.27.0) (2026-11-08)

### Features

* **app:** branch parameter on the repository diff and commits routes
* **app:** branch screen, and pressable branch rows opening it or their checkout
* **app:** branches and open pull requests routes, checkout reads on a worktree
* **app:** edit the repositories folder (defaultRepoPath) in settings
* **app:** list the configured repositories and diff their checked-out branch
* **app:** open a checkout on its uncommitted changes, branch or history
* **app:** open the repository screen from a pull request's repository name
* **app:** pull a checked-out branch from the repository screen, board-style pull request rows
* **app:** recent commits, pull and push, and checkouts found under the repositories folder
* **app:** remove a worktree from the repository screen
* **app:** repository screen with worktrees, branches and their pull requests
* **app:** several repositories folders, autodiscover, cached scan
* **app:** worktree status and removal routes, pull request heads kept as pushed
* **sdk:** read a checkout's branch diff against its default branch
* **sdk:** read the commits and the diff of a local branch that is not checked out
* **sdk:** read worktrees, local branches and open pull requests of a repository
* **sdk:** recent commits, a commit's diff, and pull or push of a checkout
* **sdk:** uncommitted diff scope, pushed commits and branch commit count
* **sdk:** uninterruptible git option for commands that delete files
* **sdk:** worktree removal status, shared refusals and a removal that never forces
* **ui:** branch diff view, a checked-out branch against its base
* **ui:** checkout view with uncommitted, branch and history tabs
* **ui:** file tree beside the checkout and branch diffs
* **ui:** link the repository name above a pull request when the app gives a link
* **ui:** read-only DiffViewer, change marks with tooltips, shared diff helpers exported
* **ui:** recent commits tab, shared commit list, pull and push buttons
* **ui:** repository overview, checkout view tabs and base slot
* **ui:** repository rows' actions at the bottom, as tonal text and icon buttons
* **ui:** worktree removal confirmation, and worktree rows with an actions slot
* **ui:** worktree rows open on press, with text and icon actions at the bottom

### Bug Fixes

* **sdk:** never mark the base branch merged
* **ui:** review status from reviewflow, repo name in header, centered badges
* **ui:** title the branches section as local branches

## [6.26.0](https://github.com/christophehurpeau/reviewflow/compare/v6.25.0...v6.26.0) (2026-11-08)

### Features

* **ui:** status accents slot, violet merged in the app

## [6.25.0](https://github.com/christophehurpeau/reviewflow/compare/v6.24.0...v6.25.0) (2026-11-08)

### Features

* **app:** find checkouts under defaultRepoPath, ~/dev/ by default
* **app:** settings in cards, two columns on a large screen
* **sdk:** put the root group last in the diff
* **ui:** browse the diff's files as a tree beside it
* **ui:** custom diff font
* **ui:** diff settings section, used by the app's settings
* **ui:** reading order list as tree rows, like the file tree
* **ui:** reviewflow code theme by role, GitHub-like, also in the editors
* **ui:** reviewflow diff theme and alouette mono font, both by default
* **ui:** tooltips on icon buttons, default tab by viewer role

### Bug Fixes

* **ui:** added and deleted lines of the reviewflow theme between pierre's and too light
* **ui:** diff comments raised on a highlight ground
* **ui:** lighter added and deleted lines in the reviewflow theme
* **ui:** lighter changed lines in the reviewflow theme
* **ui:** reviewflow theme modified color in the accent's ink, like the file lists
* **ui:** reviewflow theme's changed lines at 6% light, 15% dark
* **ui:** reviewflow theme's changed lines through pierre's mix, not mixed twice

## [6.24.0](https://github.com/christophehurpeau/reviewflow/compare/v6.23.0...v6.24.0) (2026-11-08)

### Features

* **deps:** update codemirror ([#1251](https://github.com/christophehurpeau/reviewflow/issues/1251))
* **ui:** fold files changed into the review tab

### Bug Fixes

* **ui:** size the split diff to the screen, not the window

## [6.23.0](https://github.com/christophehurpeau/reviewflow/compare/v6.22.2...v6.23.0) (2026-11-08)

### Features

* **app:** expand ~ in checkout paths of config.json
* **sdk:** share pr status, board facts and relative date

### Bug Fixes

* **ui:** dark editor tokens under the system color mode

## [6.22.2](https://github.com/christophehurpeau/reviewflow/compare/v6.22.1...v6.22.2) (2026-11-08)

### Bug Fixes

* add mongodbBinaryCacheKeyFile to configuration
* **app:** log through nightingale-app-console instead of raw json lines
* build with the wasm rollup on cpus without avx2
* **deps:** update dependency @lezer/common to v1.5.5 ([#1252](https://github.com/christophehurpeau/reviewflow/issues/1252))

## [6.22.1](https://github.com/christophehurpeau/reviewflow/compare/v6.22.0...v6.22.1) (2026-11-08)

Note: no notable changes


## [6.22.0](https://github.com/christophehurpeau/reviewflow/compare/v6.21.0...v6.22.0) (2026-11-08)

### Features

* add the local review app
* **webapp:** add a compact density option
* **webapp:** explain why creating a personal token is disabled
* **webapp:** resolve the system color mode in css

### Bug Fixes

* **deps:** refresh @expo/config-plugins to drop uuid 7.0.3 [security] ([#1245](https://github.com/christophehurpeau/reviewflow/issues/1245))
* **deps:** update dependency mingo to v7.2.7 ([#1246](https://github.com/christophehurpeau/reviewflow/issues/1246))
* **deps:** update follow-redirects to 1.16.2 [security] ([#1244](https://github.com/christophehurpeau/reviewflow/issues/1244))
* **deps:** update joi to 17.13.9 [security] ([#1242](https://github.com/christophehurpeau/reviewflow/issues/1242))
* **deps:** update node-forge to 1.4.2 [security] ([#1241](https://github.com/christophehurpeau/reviewflow/issues/1241))
* **deps:** update octokit monorepo ([#1210](https://github.com/christophehurpeau/reviewflow/issues/1210))
* **deps:** update storybook and @storybook/addon-vitest to v10.6.2 [security] ([#1232](https://github.com/christophehurpeau/reviewflow/issues/1232))
* **deps:** update vitest to v4.1.12 [security] ([#1240](https://github.com/christophehurpeau/reviewflow/issues/1240))

## [6.21.0](https://github.com/christophehurpeau/reviewflow/compare/v6.20.0...v6.21.0) (2026-10-18)

### Features

* date reviewflow's own comment and description edits
* store check run and status details and expose them in the read api

### Bug Fixes

* coalesce stream events per pull request
* cut an api response that fails after it started
* harden the pull request stream against vanished, slow and failing readers

### Performance Improvements

* wake gated subscriptions only when a relayed write changes the paid flag

## [6.20.0](https://github.com/christophehurpeau/reviewflow/compare/v6.19.0...v6.20.0) (2026-10-18)

### Features

* expose labels, review comment and body edit dates in the read api

## [6.19.0](https://github.com/christophehurpeau/reviewflow/compare/v6.18.0...v6.19.0) (2026-10-18)

### Features

* store baseSha and expose it in the read api

### Bug Fixes

* **webapp:** align contact link with the not-enabled message text

## [6.18.0](https://github.com/christophehurpeau/reviewflow/compare/v6.17.0...v6.18.0) (2026-10-18)

### Features

* gate live updates and the read API behind per-account paid features
* report errors to Sentry and log with nightingale in both servers
* show the token controls disabled with a message when the API is not enabled
* switch the store relay off with STORE_RELAY_DISABLED

### Bug Fixes

* refuse the admin to sessions of the editor extension

## [6.17.0](https://github.com/christophehurpeau/reviewflow/compare/v6.16.1...v6.17.0) (2026-10-18)

### Features

* cap live subscriptions, degrade to fetch only past the limit
* follow org membership changes in live subscriptions
* lower the per user live subscription limit to 45, reword the paused notice
* record the last conversation comment activity on pull requests
* relay bot writes to the webapp server subscriptions
* report the store relay state in GET /api/health/v1
* stream pull request changes as server-sent events on GET /api/stream/v1
* tell the user when live updates are paused
* tell the user which live subscription limit paused their updates

## [6.16.1](https://github.com/christophehurpeau/reviewflow/compare/v6.16.0...v6.16.1) (2026-10-17)

### Bug Fixes

* check the slack sign-in token with users.identity

## [6.16.0](https://github.com/christophehurpeau/reviewflow/compare/v6.15.1...v6.16.0) (2026-10-17)

### Features

* add GET /api/health on the bot and webapp servers

## [6.15.1](https://github.com/christophehurpeau/reviewflow/compare/v6.15.0...v6.15.1) (2026-10-16)

Note: no notable changes


## [6.15.0](https://github.com/christophehurpeau/reviewflow/compare/v6.14.0...v6.15.0) (2026-10-16)

### Features

* ask to sign in to slack again when the user token was revoked
* **core:** add PrDetail, the read api pull request shape
* **modules:** show unresolved review threads on pull request rows
* record mergeable on prs, reset it when the base branch moves
* **reviewflow:** strike the slack review message once its threads are resolved
* send a slack dm on merge conflict, struck through once resolved
* show unresolved conversations in the status and retry automerge when resolved
* strike resolved review comments in slack
* track unresolved review threads on prs
* **webapp-server:** add GET /api/board/v1 and /api/board-bucket/v1
* **webapp-server:** add GET /api/health/v1
* **webapp-server:** add GET /api/pr/v1/:owner/:repo/:number
* **webapp-server:** add POST /api/prs-lookup/v1
* **webapp-server:** add the read api with personal token auth and GET /api/me/v1
* **webapp-server:** conditional requests on the read api GETs
* **webapp-server:** rate limit the read api per token and failed auth per ip

### Bug Fixes

* **reviewflow:** strike the blocks of slack messages marked as done
* **reviewflow:** strike the comment body of slack messages marked as done

## [6.14.0](https://github.com/christophehurpeau/reviewflow/compare/v6.13.0...v6.14.0) (2026-10-12)

### Features

* add personal api tokens
* let org owners allow personal api tokens

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

* **codeReview:** correct logic for missing review condition
* **core:** expose init ready promise and tolerate a missing collection
* **core:** include authored prs in owner buckets
* **deps:** update fast-copy to 4.1.2 ([#1223](https://github.com/christophehurpeau/reviewflow/issues/1223))
* **reviewflow:** notify pr author on review, comment, draft and dismiss when not assigned

## [6.12.0](https://github.com/christophehurpeau/reviewflow/compare/v6.11.0...v6.12.0) (2026-10-03)

### Features

* **webapp:** add favicon and regenerate logos with the palette on build:theme
* **webapp:** migrate to alouette 24 and the sidebar app layout
* **webapp:** redesign landing page
* **webapp:** tint list section titles with the accent, not only the icon
* **webapp:** update alouette to 23.0.0
* **webapp:** use the checks mark as header brand logo

### Bug Fixes

* **deps:** refresh webapp expo toolchain for xmldom, js-yaml and image-size alerts ([#1214](https://github.com/christophehurpeau/reviewflow/issues/1214))
* **deps:** update brace-expansion to 1.1.21 and 5.0.12 ([#1216](https://github.com/christophehurpeau/reviewflow/issues/1216))
* **deps:** update qs to 6.16.0 ([#1215](https://github.com/christophehurpeau/reviewflow/issues/1215))
* **deps:** update storybook react-native to 10.6.0 for valibot alert ([#1217](https://github.com/christophehurpeau/reviewflow/issues/1217))
* **webapp:** give pr rows with actions a listitem role
* **webapp:** show connection banner only on signed in connection drops

## [6.11.0](https://github.com/christophehurpeau/reviewflow/compare/v6.10.0...v6.11.0) (2026-09-24)

### Features

* update icons

### Bug Fixes

* add criteria to exclude PR author from review buckets
* sync org throwed error because of unsupported case in liwi dependency

## [6.10.0](https://github.com/christophehurpeau/reviewflow/compare/v6.9.0...v6.10.0) (2026-09-14)

### Features

* minor cosmetic changes in webapp
* prepare for vscode extension
* update alouette

## [6.9.0](https://github.com/christophehurpeau/reviewflow/compare/v6.8.4...v6.9.0) (2026-09-11)

### Features

* **slack:** add the start review link in the review requested messages

## [6.8.4](https://github.com/christophehurpeau/reviewflow/compare/v6.8.3...v6.8.4) (2026-09-11)

### Bug Fixes

* do not start a review twice from one click
* missing creator and add tests
* tracked prs in re-requested section should not appear as untracked in requested section

## [6.8.3](https://github.com/christophehurpeau/reviewflow/compare/v6.8.2...v6.8.3) (2026-09-11)

### Bug Fixes

* ensure probot logger is initialized before use

## [6.8.2](https://github.com/christophehurpeau/reviewflow/compare/v6.8.1...v6.8.2) (2026-09-11)

### Bug Fixes

* add small delay before re-requesting self
* **slack:** pass the rest client to the slack home worker

## [6.8.1](https://github.com/christophehurpeau/reviewflow/compare/v6.8.0...v6.8.1) (2026-09-11)

### Bug Fixes

* move storybook generation inside production check to prevent loading in production builds

## [6.8.0](https://github.com/christophehurpeau/reviewflow/compare/v6.7.0...v6.8.0) (2026-09-11)

### Features

* add comment when automerge not enabled
* add module start task and update dev script to include modules
* add script for redelivering failed GitHub App webhook deliveries
* align and improve dashboard slack and webapp
* enhance PR bucket functionality with new sorting, indexing, and UI improvements
* implement ColorModeProvider and integrate into layout and header components
* improve slack blocks by reverting some changes and improving others
* start review button to avoid multiple review starting on the same team
* update alouette
* visual improvements

### Bug Fixes

* enhance error handling for already merged pull requests in auto merge logic
* fixes on urls and missing dates and missing authors/assignees with better harmonized format
* replace deleteByKey with deleteMany for repository operations
* title missing when no drafts
* update regex to handle missing closing quote in revert titles
* **webapp:** ignore pending checks excluded by configuration

## [6.7.0](https://github.com/christophehurpeau/reviewflow/compare/v6.6.0...v6.7.0) (2026-08-16)

### Features

* add webapp URL configuration and legacy redirects
* custom palette
* **deps:** update dependency @sentry/node to v10.70.0 ([#1189](https://github.com/christophehurpeau/reviewflow/issues/1189))

### Bug Fixes

* update icon type to SVGIconElement in LandingScreen

## [6.6.0](https://github.com/christophehurpeau/reviewflow/compare/v6.5.0...v6.6.0) (2026-08-15)

### Features

* **deps:** update dependency alouette to v22.6.0 ([#1200](https://github.com/christophehurpeau/reviewflow/issues/1200))
* implement repository deletion and archiving handling

### Bug Fixes

* **deps:** update dependency react-native-reanimated to v4.5.3 ([#1195](https://github.com/christophehurpeau/reviewflow/issues/1195))
* **deps:** update octokit monorepo ([#1193](https://github.com/christophehurpeau/reviewflow/issues/1193))
* **deps:** update react monorepo to v19.2.8 ([#1198](https://github.com/christophehurpeau/reviewflow/issues/1198))

## [6.5.0](https://github.com/christophehurpeau/reviewflow/compare/v6.4.0...v6.5.0) (2026-08-15)

### Features

* adjust spacing and font size in PR row component for improved layout
* support accounts instead of organizations in PR queries and filters

### Bug Fixes

* **deps:** update dependency react-native-svg to v15.15.5 ([#1196](https://github.com/christophehurpeau/reviewflow/issues/1196))

## [6.4.0](https://github.com/christophehurpeau/reviewflow/compare/v6.3.2...v6.4.0) (2026-08-15)

### Features

* better webapp and split servers

## [6.3.2](https://github.com/christophehurpeau/reviewflow/compare/v6.3.1...v6.3.2) (2026-08-13)

### Features

* sync labels

### Bug Fixes

* implement failed checks and statuses handling for auto merge

