# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.100.2](https://github.com/christophehurpeau/reviewflow/compare/v1.100.1...v1.100.2) (2022-04-23)


### Bug Fixes

* **deps:** update dependency probot to v12.2.2 ([#484](https://github.com/christophehurpeau/reviewflow/issues/484)) ([c92b699](https://github.com/christophehurpeau/reviewflow/commit/c92b699e77ad6f0778e50539c1baf0a27ed8329f))

### [1.100.1](https://github.com/christophehurpeau/reviewflow/compare/v1.100.0...v1.100.1) (2022-03-13)


### Bug Fixes

* ignore sending slack message when assigned by reviewflow ([0e9d5a7](https://github.com/christophehurpeau/reviewflow/commit/0e9d5a7300f0e91adc9954cd562b2a5945297ed8))

## [1.100.0](https://github.com/christophehurpeau/reviewflow/compare/v1.99.0...v1.100.0) (2022-03-12)


### Features

* **deps:** update dependency @slack/web-api to v6.7.0 ([#471](https://github.com/christophehurpeau/reviewflow/issues/471)) ([f523127](https://github.com/christophehurpeau/reviewflow/commit/f523127f0c4a4703ba65f08e502cc4849b0a0ae5))


### Bug Fixes

* **deps:** update dependency emoji-regex to v10.0.1 ([#481](https://github.com/christophehurpeau/reviewflow/issues/481)) ([f04fec8](https://github.com/christophehurpeau/reviewflow/commit/f04fec89833d9ec587d7c99ad899d6d9ef69addc))

## [1.99.0](https://github.com/christophehurpeau/reviewflow/compare/v1.98.0...v1.99.0) (2022-02-20)


### Features

* enable for liwijs ([55ef686](https://github.com/christophehurpeau/reviewflow/commit/55ef68652ac48bc58e6d05b877db04e901f23345))

## [1.98.0](https://github.com/christophehurpeau/reviewflow/compare/v1.97.0...v1.98.0) (2022-02-20)


### Features

* **deps:** update commitlint monorepo to v16.2.1 ([#461](https://github.com/christophehurpeau/reviewflow/issues/461)) ([4bb914a](https://github.com/christophehurpeau/reviewflow/commit/4bb914aa8d6465d14d93982c01c1e3c1eaa8218b))
* **deps:** update dependency @octokit/webhooks to v9.22.0 ([#402](https://github.com/christophehurpeau/reviewflow/issues/402)) ([1358ee0](https://github.com/christophehurpeau/reviewflow/commit/1358ee00a6befccb3046862718c17af75810ddc7))
* review comments in threads ([69b8cbe](https://github.com/christophehurpeau/reviewflow/commit/69b8cbe11dd8834cca43e0a8c7294161fddfc353))
* support assigned and unassigned events ([ff50bc1](https://github.com/christophehurpeau/reviewflow/commit/ff50bc12080c83dd1e9533e1fc9cf8e3bb6ac925))


### Bug Fixes

* auto approve again when reviewflow approval was dismissed ([7fcb5b9](https://github.com/christophehurpeau/reviewflow/commit/7fcb5b9d5510ee1b68b1484746db061de0d68db2))
* **deps:** update dependency body-parser to v1.19.2 ([#463](https://github.com/christophehurpeau/reviewflow/issues/463)) ([751dd45](https://github.com/christophehurpeau/reviewflow/commit/751dd454aecac6f6b088714b6116a2e4040792cc))
* ignore code approved label for dismissed review ([ca31932](https://github.com/christophehurpeau/reviewflow/commit/ca31932bf757006628f08c3a28432e65a96f9f51))
* make sure db and server are closed properly ([15495f1](https://github.com/christophehurpeau/reviewflow/commit/15495f1ba4552a3acc284d9b97b435b53e77a9d7))

## [1.97.0](https://github.com/christophehurpeau/reviewflow/compare/v1.96.0...v1.97.0) (2022-01-29)


### Features

* **deps:** update dependency @slack/web-api to v6.6.0 ([#424](https://github.com/christophehurpeau/reviewflow/issues/424)) ([2035990](https://github.com/christophehurpeau/reviewflow/commit/2035990c6076c0582de0f1d45abdd658f6ca9ca2))

## [1.96.0](https://github.com/christophehurpeau/reviewflow/compare/v1.95.0...v1.96.0) (2022-01-23)


### Features

* add experimental feature lintPullRequestTitleWithConventionalCommit ([06d5b37](https://github.com/christophehurpeau/reviewflow/commit/06d5b3747923f9d04987c8033afe79895223ad05))
* parse commit message with @commitlint/config-conventional ([bf0ca6a](https://github.com/christophehurpeau/reviewflow/commit/bf0ca6a926acbfa60d1352a5ea916b1015c84e33))


### Bug Fixes

* clean (no issue) typo ([eec7009](https://github.com/christophehurpeau/reviewflow/commit/eec70098be97dfbba7907e9e3ec304b3029db148))
* clean [no isssue] typo ([21c20b7](https://github.com/christophehurpeau/reviewflow/commit/21c20b7dc395ea920d04c499e7c6f93345d0fe1e))
* **deps:** update dependency probot to v12.2.1 ([#421](https://github.com/christophehurpeau/reviewflow/issues/421)) ([94d04b7](https://github.com/christophehurpeau/reviewflow/commit/94d04b7d7ffc4e8c72ebab8e41c5622de416c233))
* use label to prevent multiple update branch action at the same time ([ebd8a06](https://github.com/christophehurpeau/reviewflow/commit/ebd8a06f9850d5a85e7ec4147fb4c6f0b888c423))

## [1.95.0](https://github.com/christophehurpeau/reviewflow/compare/v1.94.2...v1.95.0) (2022-01-22)


### Features

* add actions in reviewflow comment ([a49fdef](https://github.com/christophehurpeau/reviewflow/commit/a49fdefbd9961502d139989c54be49f0752b5fa8))

### [1.94.2](https://github.com/christophehurpeau/reviewflow/compare/v1.94.1...v1.94.2) (2022-01-22)


### Bug Fixes

* also edit status check from labels on edited event ([631cbcf](https://github.com/christophehurpeau/reviewflow/commit/631cbcf31bd4178a48922a043ce268682a7426ab))

### [1.94.1](https://github.com/christophehurpeau/reviewflow/compare/v1.94.0...v1.94.1) (2022-01-21)


### Bug Fixes

* lint-pr status condition ([e666388](https://github.com/christophehurpeau/reviewflow/commit/e66638837c6ccc5f6bee5cd08b9b452f47e97f2f))

## [1.94.0](https://github.com/christophehurpeau/reviewflow/compare/v1.93.0...v1.94.0) (2022-01-20)


### Features

* **deps:** update dependency probot to v12.2.0 ([#400](https://github.com/christophehurpeau/reviewflow/issues/400)) ([8148ece](https://github.com/christophehurpeau/reviewflow/commit/8148ece6810725c226d7696525e5728ffdff2ffd))
* save statuses to avoid spamming github api ([8318515](https://github.com/christophehurpeau/reviewflow/commit/831851562ea924d989c6ae7e07c991611673bfa4))


### Bug Fixes

* automerge ignore codecov and test-e2e ([2502fcf](https://github.com/christophehurpeau/reviewflow/commit/2502fcfb8ca24e5358c6c9d8dda37655a088bcef))

## [1.93.0](https://github.com/christophehurpeau/reviewflow/compare/v1.92.0...v1.93.0) (2022-01-05)


### Features

* update @octokit/webhooks ([43f7aa7](https://github.com/christophehurpeau/reviewflow/commit/43f7aa7f17cd7b7becf2c528ed008e826ef64a78))

## [1.92.0](https://github.com/christophehurpeau/reviewflow/compare/v1.91.1...v1.92.0) (2022-01-02)


### Features

* **accountConfigs:** add external-padok in dev team ([3bcab12](https://github.com/christophehurpeau/reviewflow/commit/3bcab1223092ab5a6e6b86e726b65c662d10375c))

### [1.91.1](https://github.com/christophehurpeau/reviewflow/compare/v1.91.0...v1.91.1) (2022-01-02)


### Bug Fixes

* treat renovate/stability-days pending status as failed to avoid blocking prs that can be merged ([ca79c7e](https://github.com/christophehurpeau/reviewflow/commit/ca79c7e65ac96782ebd0e662b14b7b95593db813))

## [1.91.0](https://github.com/christophehurpeau/reviewflow/compare/v1.90.0...v1.91.0) (2022-01-01)


### Features

* **deps:** update dependency @slack/web-api to v6.5.1 ([#233](https://github.com/christophehurpeau/reviewflow/issues/233)) ([8798a52](https://github.com/christophehurpeau/reviewflow/commit/8798a52768f980fbd4fb4c6aaaf7ec1351bc147a))
* dont automerge when checks or statuses are pending ([5adb650](https://github.com/christophehurpeau/reviewflow/commit/5adb6506e734ac2401108413023790f31489005f))

## [1.90.0](https://www.github.com/christophehurpeau/reviewflow/compare/v1.89.0...v1.90.0) (2022-01-01)


### Features

* **deps:** update dependency @commitlint/parse to v16 ([#379](https://www.github.com/christophehurpeau/reviewflow/issues/379)) ([3d6f6b8](https://www.github.com/christophehurpeau/reviewflow/commit/3d6f6b8753484d839b2664a417538b0f6fb355db))
* **deps:** update dependency simple-oauth2 to v4.3.0 ([#373](https://www.github.com/christophehurpeau/reviewflow/issues/373)) ([bd09993](https://www.github.com/christophehurpeau/reviewflow/commit/bd099934bcd071383119336db7d496beb5c0eaa4))


### Bug Fixes

* check if a PR can be merged after a review request is removed ([19406c6](https://www.github.com/christophehurpeau/reviewflow/commit/19406c64431e076d7d90785d62dd4e76ca1d2693))
* in review submitted event, use updated pr in approveShouldWait too ([8848afb](https://www.github.com/christophehurpeau/reviewflow/commit/8848afb51e2d27a2a70d17234421100ab043e07b))
* update slack home after review is dismissed even if repo is ignored ([7e85dd4](https://www.github.com/christophehurpeau/reviewflow/commit/7e85dd4f603ebffff8a542e610eb6c5d5827ed25))

## [1.89.0](https://www.github.com/christophehurpeau/reviewflow/compare/v1.88.1...v1.89.0) (2021-12-15)


### Features

* change ornikar config ignoreRepoPattern ([1bd694b](https://www.github.com/christophehurpeau/reviewflow/commit/1bd694be867640364adc0959b0f739135d4aca2f))


### Bug Fixes

* **deps:** update dependency body-parser to v1.19.1 ([#358](https://www.github.com/christophehurpeau/reviewflow/issues/358)) ([c7fd9e9](https://www.github.com/christophehurpeau/reviewflow/commit/c7fd9e9dfbb450facda943c12a71131d81c1ee2d))
* **deps:** update dependency probot to v12.1.3 ([#353](https://www.github.com/christophehurpeau/reviewflow/issues/353)) ([cb8aac0](https://www.github.com/christophehurpeau/reviewflow/commit/cb8aac00794c433a8a21926f9a8dbb189b6d3db6))
* **deps:** update dependency slackify-markdown to v4.3.1 ([#352](https://www.github.com/christophehurpeau/reviewflow/issues/352)) ([4c7ce61](https://www.github.com/christophehurpeau/reviewflow/commit/4c7ce617bb9eeb60a51de575429c0db028185eaa))

### [1.88.1](https://github.com/christophehurpeau/reviewflow/compare/v1.88.0...v1.88.1) (2021-12-12)


### Bug Fixes

* correctly save untick/tick team to silent ([51c05c2](https://github.com/christophehurpeau/reviewflow/commit/51c05c2a323485ed87822104345b2b3eb873140a))
* **deps:** update dependency probot to v12.1.2 ([#345](https://github.com/christophehurpeau/reviewflow/issues/345)) ([714efae](https://github.com/christophehurpeau/reviewflow/commit/714efae81c59ceaa1dd9ef90619c38246ed6dea2))

## [1.88.0](https://github.com/christophehurpeau/reviewflow/compare/v1.87.0...v1.88.0) (2021-12-04)


### Features

* **deps:** update dependency liwi-mongo to v8.3.1 ([#338](https://github.com/christophehurpeau/reviewflow/issues/338)) ([930c598](https://github.com/christophehurpeau/reviewflow/commit/930c5985ef844c5498cf61cb0138dcd4d489c432))


### Bug Fixes

* support userDmSettings to not have silentTeams setup ([04a33ad](https://github.com/christophehurpeau/reviewflow/commit/04a33ada1ee8f5ef384dcef88747e2f65052b6ea))
* **deps:** update dependency cookie-parser to v1.4.6 ([#332](https://github.com/christophehurpeau/reviewflow/issues/332)) ([2d6beba](https://github.com/christophehurpeau/reviewflow/commit/2d6bebabcc88176159ea7c5fa0206fe9d16a1194))

## [1.87.0](https://github.com/christophehurpeau/reviewflow/compare/v1.86.0...v1.87.0) (2021-12-04)


### Features

* add feature to silent teams notifications in settings ([eb29508](https://github.com/christophehurpeau/reviewflow/commit/eb29508a0ec1ff8251ca7399bbdb0a157a8c8f91))
* add github teams list in app ([d6a5168](https://github.com/christophehurpeau/reviewflow/commit/d6a5168e118d4e18d3d95a098fc9fefe2533fcaa))
* better repo merge queue with db save and timeout ([ab13eb1](https://github.com/christophehurpeau/reviewflow/commit/ab13eb1da29d893e1ec96cd6f7fb21a0202a40e5))


### Bug Fixes

* **automerge:** add timeout to prevent prs blocking automerge system ([b8f02db](https://github.com/christophehurpeau/reviewflow/commit/b8f02db14348b2334787dc2ecbce8a9ad778f799))
* reverse tick for silenting teams ([543a5bd](https://github.com/christophehurpeau/reviewflow/commit/543a5bdf2931a0bf3de13a2d7c19d1faadc12216))
* team from githubTeamName ([1c55d61](https://github.com/christophehurpeau/reviewflow/commit/1c55d6198bec3aa4322701ef770feb72b5ad6a69))

## [1.86.0](https://github.com/christophehurpeau/reviewflow/compare/v1.85.2...v1.86.0) (2021-11-10)


### Features

* better draft support ([#325](https://github.com/christophehurpeau/reviewflow/issues/325)) ([201a57b](https://github.com/christophehurpeau/reviewflow/commit/201a57b2e945d924ea35b4b994cd42039b7ab9ff))
* **deps:** update dependency @commitlint/parse to v14 ([#297](https://github.com/christophehurpeau/reviewflow/issues/297)) ([47027a8](https://github.com/christophehurpeau/reviewflow/commit/47027a833bb8f7583f7b448828b2c0c44669e0fe))
* **deps:** update dependency emoji-regex to v10 ([#305](https://github.com/christophehurpeau/reviewflow/issues/305)) ([dba02bc](https://github.com/christophehurpeau/reviewflow/commit/dba02bc7c56999d1a3af029ea46ad7a054ebf028))
* **deps:** update dependency probot to v11.4.1 ([#294](https://github.com/christophehurpeau/reviewflow/issues/294)) ([c593fc8](https://github.com/christophehurpeau/reviewflow/commit/c593fc8cf90789294fd1f90e23a85b746476918b))
* **deps:** update dependency probot to v12 ([#308](https://github.com/christophehurpeau/reviewflow/issues/308)) ([7f6b273](https://github.com/christophehurpeau/reviewflow/commit/7f6b2732de21bd5735ecba922d66e6510eed24a9))
* better titles ([5e3b3dd](https://github.com/christophehurpeau/reviewflow/commit/5e3b3dd77887aa62e04e5c138f736f55394760b1))
* specify status when merge failed and status exists ([f0db6ed](https://github.com/christophehurpeau/reviewflow/commit/f0db6ed21b0581f0316284e7770571e11d972716))


### Bug Fixes

* update and delete comments ([#324](https://github.com/christophehurpeau/reviewflow/issues/324)) ([85c724f](https://github.com/christophehurpeau/reviewflow/commit/85c724f6290fc23c16e0fbba4f00811b357a0c3c))

### [1.85.2](https://github.com/christophehurpeau/reviewflow/compare/v1.85.1...v1.85.2) (2021-10-24)


### Bug Fixes

* renovate was not considered as a bot ([7c4be18](https://github.com/christophehurpeau/reviewflow/commit/7c4be18641f1935a428618216b4921310c008c48))

### [1.85.1](https://github.com/christophehurpeau/reviewflow/compare/v1.85.0...v1.85.1) (2021-10-24)


### Bug Fixes

* missing new line in multiple breaking changes ([d589ebc](https://github.com/christophehurpeau/reviewflow/commit/d589ebc7b1d14f45148cebec4858b97518eeef8f))

## [1.85.0](https://github.com/christophehurpeau/reviewflow/compare/v1.84.1...v1.85.0) (2021-10-07)


### Features

* add external-bam team to dev group ([6dbbf1f](https://github.com/christophehurpeau/reviewflow/commit/6dbbf1f4bfe961c608f4a179b067fef89da3fbe8))

### [1.84.1](https://github.com/christophehurpeau/reviewflow/compare/v1.84.0...v1.84.1) (2021-10-01)


### Bug Fixes

* update slack home with slackTeams collection ([d6f57d6](https://github.com/christophehurpeau/reviewflow/commit/d6f57d605878c6c018f6a101cffc7cba6ca7981f))

## [1.84.0](https://github.com/christophehurpeau/reviewflow/compare/v1.83.0...v1.84.0) (2021-10-01)


### Features

* add Jérémy to the list of ornikar users ([#274](https://github.com/christophehurpeau/reviewflow/issues/274)) ([fa06f57](https://github.com/christophehurpeau/reviewflow/commit/fa06f5713cba35567ca9d8e6fe71f0e7bd211479))
* connect to slack via app instead of config file ([ee352a9](https://github.com/christophehurpeau/reviewflow/commit/ee352a957ae8d0906ba7c6658c29ad9f7f27282f))
* improve slack connect ([ca3b13d](https://github.com/christophehurpeau/reviewflow/commit/ca3b13d69f6782635c9ee10289301326d9168aaf))
* starting to support external slack teams ([0896ba6](https://github.com/christophehurpeau/reviewflow/commit/0896ba608a4dccc27738e7a9a9f272e94b9f6e37))


### Bug Fixes

* connect to slack ([8c10636](https://github.com/christophehurpeau/reviewflow/commit/8c10636f8fa4dade3eb8a4cdc076951ea3eade66))
* slack home ([2189200](https://github.com/christophehurpeau/reviewflow/commit/2189200a5c37cd82195e388bb7f9b6aad3118896))
* use cjs for now ([14040dd](https://github.com/christophehurpeau/reviewflow/commit/14040dd41cf4136c386335eb1ed8448ab5aabd91))

## [1.83.0](https://github.com/christophehurpeau/reviewflow/compare/v1.82.0...v1.83.0) (2021-06-06)


### Features

* **deps:** update dependency slackify-markdown to v4.3.0 ([#241](https://github.com/christophehurpeau/reviewflow/issues/241)) ([79a2623](https://github.com/christophehurpeau/reviewflow/commit/79a2623dca64b1056d2352238cfde50d70a481c7))
* add rchabin to reviewers ([#226](https://github.com/christophehurpeau/reviewflow/issues/226)) ([6083bee](https://github.com/christophehurpeau/reviewflow/commit/6083beeadc0619e963f5175f81ffebb134196782))
* add tnesztler to reviewers [no issue] ([#242](https://github.com/christophehurpeau/reviewflow/issues/242)) ([9364d41](https://github.com/christophehurpeau/reviewflow/commit/9364d41ecd8833ebc37461f6605f5f267af94fe9))
* **deps:** update dependency dotenv to v8.6.0 ([#234](https://github.com/christophehurpeau/reviewflow/issues/234)) ([385ccb3](https://github.com/christophehurpeau/reviewflow/commit/385ccb36d9882acacd9784718c53fe4924b6a9af))


### Bug Fixes

* renovate update branch areCommitsAllMadeByBots ([e1a574a](https://github.com/christophehurpeau/reviewflow/commit/e1a574afc51f0bf2ef4fbfee13a06136f62ebfc5))
* **deps:** update dependency @commitlint/parse to v12.1.4 ([#240](https://github.com/christophehurpeau/reviewflow/issues/240)) ([791a330](https://github.com/christophehurpeau/reviewflow/commit/791a3305248fb81f34aef8dad0e1a900f090925a))
* typo and build ornikar config ([8159754](https://github.com/christophehurpeau/reviewflow/commit/81597546301b344aa7109246e3f0ba201cf9e320))

## [1.82.0](https://github.com/christophehurpeau/reviewflow/compare/v1.81.0...v1.82.0) (2021-05-08)


### Features

* **deps:** update dependency @commitlint/parse to v12 ([#217](https://github.com/christophehurpeau/reviewflow/issues/217)) ([ee9b450](https://github.com/christophehurpeau/reviewflow/commit/ee9b450f490de331cecc5ce922540644af972877))


### Bug Fixes

* prevent rebasing renovate if commit were made by humans & automerge with breaking change info ([f5b5c5a](https://github.com/christophehurpeau/reviewflow/commit/f5b5c5aaa92f39d12f15b1a58e9d9f7eb0150785))
* remove console.log ([4875b66](https://github.com/christophehurpeau/reviewflow/commit/4875b665d2e4ba133cf95377b82f1e9d5101fc45))

## [1.81.0](https://github.com/christophehurpeau/reviewflow/compare/v1.80.0...v1.81.0) (2021-03-23)


### Features

* improve ideal branch name regexp ([4c0688d](https://github.com/christophehurpeau/reviewflow/commit/4c0688d88b5d150f27abcabc499f94949bc7dd8c))

## [1.80.0](https://github.com/christophehurpeau/reviewflow/compare/v1.79.1...v1.80.0) (2021-03-23)


### Features

* more flexible branch name status ([315d4d0](https://github.com/christophehurpeau/reviewflow/commit/315d4d0a94f3c8029b1e5442fac3c87d125e3d28))


### Bug Fixes

* branch name check and improve status messages ([24caaf1](https://github.com/christophehurpeau/reviewflow/commit/24caaf134f9cf789532c6255bad2654f0b078119))

### [1.79.1](https://github.com/christophehurpeau/reviewflow/compare/v1.79.0...v1.79.1) (2021-03-17)


### Bug Fixes

* status max length ([6a0906e](https://github.com/christophehurpeau/reviewflow/commit/6a0906e1052ec4d53f38fbeef81681e819817452))

## [1.79.0](https://github.com/christophehurpeau/reviewflow/compare/v1.78.0...v1.79.0) (2021-03-14)


### Features

* allow error to depend on title ([e325e0d](https://github.com/christophehurpeau/reviewflow/commit/e325e0d11110e7b1e8e3aff079380c43ea7c9dda))
* lint pr head, base and add optional url ([fac951c](https://github.com/christophehurpeau/reviewflow/commit/fac951c39c6d0e40b6c86455599b8c575a1a5455))


### Bug Fixes

* remove console.log ([c8acfdf](https://github.com/christophehurpeau/reviewflow/commit/c8acfdf771d93a650a79c54bc316e106c462b98b))

## [1.78.0](https://github.com/christophehurpeau/reviewflow/compare/v1.77.0...v1.78.0) (2021-02-23)


### Features

* ornikar config allow uppercase in scope ([300e412](https://github.com/christophehurpeau/reviewflow/commit/300e412c5ff42856195f51886a7b0cbfbc8a848b))
* **deps:** update dependency @octokit/core to v3.2.5 ([#178](https://github.com/christophehurpeau/reviewflow/issues/178)) ([31081f1](https://github.com/christophehurpeau/reviewflow/commit/31081f13e5ee970a7d9a8c56fdb362de54a3c87b))
* **deps:** update dependency @octokit/rest to v18.0.15 ([#179](https://github.com/christophehurpeau/reviewflow/issues/179)) ([b2f4d7f](https://github.com/christophehurpeau/reviewflow/commit/b2f4d7f7e9a90df6e68c124f2fa9e05cda98e706))
* **deps:** update dependency emoji-regex to v9.2.1 ([#181](https://github.com/christophehurpeau/reviewflow/issues/181)) ([950d2c1](https://github.com/christophehurpeau/reviewflow/commit/950d2c133dd2669467e06195eaa95237fa8eb4c9))
* **deps:** update dependency probot to v11.0.6 ([#193](https://github.com/christophehurpeau/reviewflow/issues/193)) ([4f3aed3](https://github.com/christophehurpeau/reviewflow/commit/4f3aed311817c5e5f3a8e98a0dc570a95d849abd))

## [1.77.0](https://github.com/christophehurpeau/reviewflow/compare/v1.76.3...v1.77.0) (2021-01-30)


### Features

* nicer options look and description ([0b4083b](https://github.com/christophehurpeau/reviewflow/commit/0b4083b0fb9f2bbbe4c7515c0dda85249f9b264c))

### [1.76.3](https://github.com/christophehurpeau/reviewflow/compare/v1.76.2...v1.76.3) (2021-01-30)


### Bug Fixes

* removing comment creation on open pr event to avoid duplicates ([2d6c10f](https://github.com/christophehurpeau/reviewflow/commit/2d6c10f45fd1532a3dc51bc1194dc37853b36659))

### [1.76.2](https://github.com/christophehurpeau/reviewflow/compare/v1.76.1...v1.76.2) (2021-01-28)


### Bug Fixes

* use team id not team slug to find members ([c876a59](https://github.com/christophehurpeau/reviewflow/commit/c876a59d85071c6f1d12d5878c9447401f310ff0))

### [1.76.1](https://github.com/christophehurpeau/reviewflow/compare/v1.76.0...v1.76.1) (2021-01-28)


### Bug Fixes

* logins ops team in ornikar config ([09c748e](https://github.com/christophehurpeau/reviewflow/commit/09c748e6e89cd654f100ce8cdbcd344aea51fcc7))

## [1.76.0](https://github.com/christophehurpeau/reviewflow/compare/v1.75.0...v1.76.0) (2021-01-28)


### Features

* add aymen in ornikar config ([a9007a3](https://github.com/christophehurpeau/reviewflow/commit/a9007a3c908b7a4899ccbb1c50682df80a4e367d))

## [1.75.0](https://github.com/christophehurpeau/reviewflow/compare/v1.74.3...v1.75.0) (2021-01-26)


### Features

* **deps:** update dependency @octokit/rest to v18.0.14 ([#175](https://github.com/christophehurpeau/reviewflow/issues/175)) ([97e0a4a](https://github.com/christophehurpeau/reviewflow/commit/97e0a4aed676f2b36e48617c68f1472708bc478f))


### Bug Fixes

* dont add skip ci label when code approved ([f9bee58](https://github.com/christophehurpeau/reviewflow/commit/f9bee581be0cfa575944c374b504f981cf791309))

### [1.74.3](https://github.com/christophehurpeau/reviewflow/compare/v1.74.2...v1.74.3) (2021-01-22)


### Bug Fixes

* **context:** set to githubTeamNameToGroup :facepalm: ([1003760](https://github.com/christophehurpeau/reviewflow/commit/1003760684ad63dd9bdc3b1ae088cedb2ef19401))

### [1.74.2](https://github.com/christophehurpeau/reviewflow/compare/v1.74.1...v1.74.2) (2021-01-22)


### Bug Fixes

* **context:** groupsGithubTeams is an object of arrays ([d2aaeae](https://github.com/christophehurpeau/reviewflow/commit/d2aaeae20b5adf041284eeca101a2f92ccc04614))

### [1.74.1](https://github.com/christophehurpeau/reviewflow/compare/v1.74.0...v1.74.1) (2021-01-22)


### Bug Fixes

* **configs:** add frontend-architects in dev group github teams ([e7c3ae3](https://github.com/christophehurpeau/reviewflow/commit/e7c3ae3d5de15082b7873b5966b227c5efd25a25))

## [1.74.0](https://github.com/christophehurpeau/reviewflow/compare/v1.73.0...v1.74.0) (2021-01-22)


### Features

* add olivier to backend team ([#176](https://github.com/christophehurpeau/reviewflow/issues/176)) ([cd8a68f](https://github.com/christophehurpeau/reviewflow/commit/cd8a68f3f912d1cb34ef43f798e13fae41ad1124))

## [1.73.0](https://github.com/christophehurpeau/reviewflow/compare/v1.72.0...v1.73.0) (2021-01-21)


### Features

* initial support for requested_teams ([e8e9e94](https://github.com/christophehurpeau/reviewflow/commit/e8e9e94c48bdfc42967930fe23ad1c3bf5e540c5))
* **deps:** update dependency @slack/web-api to v6 ([#163](https://github.com/christophehurpeau/reviewflow/issues/163)) ([cfd8971](https://github.com/christophehurpeau/reviewflow/commit/cfd897125d7818810be687b15ed361ce70721292))
* **deps:** update dependency liwi-mongo to v8.0.4 ([#174](https://github.com/christophehurpeau/reviewflow/issues/174)) ([68e7aea](https://github.com/christophehurpeau/reviewflow/commit/68e7aea513de181292aa58d7a70a1b1843f03de3))

## [1.72.0](https://github.com/christophehurpeau/reviewflow/compare/v1.71.0...v1.72.0) (2021-01-21)


### Features

* configure githubTeamSlug ([51b7e3e](https://github.com/christophehurpeau/reviewflow/commit/51b7e3e5eac92122c0fa8ce0875a52aabc52757e))
* **deps:** update dependency slackify-markdown to v4 ([#149](https://github.com/christophehurpeau/reviewflow/issues/149)) ([6cd4c2e](https://github.com/christophehurpeau/reviewflow/commit/6cd4c2e4842fa892463a3d42bbf3cdd80ed7caf9))
* add aenario in accountConfigs ([#170](https://github.com/christophehurpeau/reviewflow/issues/170)) ([2f005c1](https://github.com/christophehurpeau/reviewflow/commit/2f005c1ec76e10a8f2ba2b6c1e5589e721ed5329))
* add camillebaronnet in accountConfigs ([#161](https://github.com/christophehurpeau/reviewflow/issues/161)) ([c9a5929](https://github.com/christophehurpeau/reviewflow/commit/c9a592968668e2bdfc418c75edcd1b20ae48be96))
* add slack email for loicleser ([35f4a68](https://github.com/christophehurpeau/reviewflow/commit/35f4a68ad4d3f3f780674fab82bbff61ae46674e))
* probot 11 and fix tsc issue ([d76f9d6](https://github.com/christophehurpeau/reviewflow/commit/d76f9d6071edcec01e303b9bd62308669c98d9e5))
* **deps:** update dependency @slack/web-api to v5.15.0 ([#156](https://github.com/christophehurpeau/reviewflow/issues/156)) ([e4bedb2](https://github.com/christophehurpeau/reviewflow/commit/e4bedb2c3783170661ff08e9b88048237cc4768a))
* sync teams and team members ([5d318e0](https://github.com/christophehurpeau/reviewflow/commit/5d318e03f585dec3470676087d220c62310ac7b6))


### Bug Fixes

* config ornikar ([76d512d](https://github.com/christophehurpeau/reviewflow/commit/76d512d205145d340cf55a4900f773ea4c09690d))
* label description can be undefined ([5d7fab4](https://github.com/christophehurpeau/reviewflow/commit/5d7fab4f7d57909275058eb30580482b8e004248))
* lint ([afe8523](https://github.com/christophehurpeau/reviewflow/commit/afe85233408fe04f3e1dea68d1819f4df75fa794))
* probot 11 run callback ([f46699a](https://github.com/christophehurpeau/reviewflow/commit/f46699ae1cceb48f4e2052abd17c19a85fc99be0))
* relative imports ([efffa8a](https://github.com/christophehurpeau/reviewflow/commit/efffa8afd532ad1878bb63a3147d3cfaf409e52e))
* update probot ([abbaca9](https://github.com/christophehurpeau/reviewflow/commit/abbaca9ca3b01738be4705442c44ef78c059277c))

## [1.71.0](https://github.com/christophehurpeau/reviewflow/compare/v1.70.0...v1.71.0) (2021-01-11)


### Features

* add camillebaronnet in accountConfigs ([#161](https://github.com/christophehurpeau/reviewflow/issues/161)) ([2b41ab0](https://github.com/christophehurpeau/reviewflow/commit/2b41ab037a74cf41aca60b9a4dfcbfb2f1dfdb2f))


### Bug Fixes

* backends logins ([f18d6e8](https://github.com/christophehurpeau/reviewflow/commit/f18d6e8b60c7bf33be5c95d471bb0002b74aee91))
* prettier ([2902da6](https://github.com/christophehurpeau/reviewflow/commit/2902da6afe289a47dd12439d843d832260ffdfbf))

## [1.70.0](https://github.com/christophehurpeau/reviewflow/compare/v1.69.2...v1.70.0) (2020-12-21)


### Features

* robot face ([3b145a3](https://github.com/christophehurpeau/reviewflow/commit/3b145a3d42b222a84c8b48dfffa91afaff74490f))

### [1.69.2](https://github.com/christophehurpeau/reviewflow/compare/v1.69.1...v1.69.2) (2020-12-21)


### Bug Fixes

* add title preview and prevent github to add hudge previews ([14e3c42](https://github.com/christophehurpeau/reviewflow/commit/14e3c424f258e042c5bde268821a88748dda77fc))

### [1.69.1](https://github.com/christophehurpeau/reviewflow/compare/v1.69.0...v1.69.1) (2020-12-20)


### Bug Fixes

* import commitNode from commitlint types ([d2442ba](https://github.com/christophehurpeau/reviewflow/commit/d2442ba90ae31b0c935d277d781bdbbd141243c5))

## [1.69.0](https://github.com/christophehurpeau/reviewflow/compare/v1.68.0...v1.69.0) (2020-12-20)


### Features

* **deps:** update dependency @commitlint/parse to v11 ([#141](https://github.com/christophehurpeau/reviewflow/issues/141)) ([b3a8efe](https://github.com/christophehurpeau/reviewflow/commit/b3a8efe5d3aa22a0de77ac0626a646ea4b98c01b))
* **deps:** update dependency simple-oauth2 to v4 ([#144](https://github.com/christophehurpeau/reviewflow/issues/144)) ([0cf3d57](https://github.com/christophehurpeau/reviewflow/commit/0cf3d57efee47d471a7d24bd1abc37f4439779cb))
* **deps:** update dependency slackify-markdown to v3 ([#145](https://github.com/christophehurpeau/reviewflow/issues/145)) ([7c94748](https://github.com/christophehurpeau/reviewflow/commit/7c94748c0047c769115cd5b7d1006ea4effbac76))
* **deps:** update react monorepo to v17 (major) ([#146](https://github.com/christophehurpeau/reviewflow/issues/146)) ([148371c](https://github.com/christophehurpeau/reviewflow/commit/148371c6073aeae20fc9cb11987397ac9c4aa04c))


### Bug Fixes

* also update slack home when pr is reopened ([be8fc96](https://github.com/christophehurpeau/reviewflow/commit/be8fc9689d6fa8d979465342189f146771365c41))
* always request a review for non approved renovate prs ([6ed428e](https://github.com/christophehurpeau/reviewflow/commit/6ed428e8f1fd58f0e186cf85ab465d8457fa8611))
* auth error and port ([27fce2e](https://github.com/christophehurpeau/reviewflow/commit/27fce2e261c28a37074c30518ab7f69e2134a35f))
* remove needsReview label for auto aproved renovate prs ([4144c8b](https://github.com/christophehurpeau/reviewflow/commit/4144c8b47c9c690b9fdd93683712c934ac68a611))

## [1.68.0](https://github.com/christophehurpeau/reviewflow/compare/v1.67.0...v1.68.0) (2020-12-20)


### Features

* send notifications for closed, merged and reopened PRs ([4cfc6a0](https://github.com/christophehurpeau/reviewflow/commit/4cfc6a02b6bc372097b50c93688ac63d217d7e68))
* **deps:** update dependency @octokit/webhooks to v7.21.0 ([#132](https://github.com/christophehurpeau/reviewflow/issues/132)) ([32d0542](https://github.com/christophehurpeau/reviewflow/commit/32d0542c375162c6efa604e9d88749209285e01b))
* **deps:** update dependency @slack/web-api to v5.14.0 ([#133](https://github.com/christophehurpeau/reviewflow/issues/133)) ([8b9a0ae](https://github.com/christophehurpeau/reviewflow/commit/8b9a0ae4f535b763849f2fdfc4d4929783d44090))
* **deps:** update dependency emoji-regex to v9.2.0 ([#134](https://github.com/christophehurpeau/reviewflow/issues/134)) ([8da8c83](https://github.com/christophehurpeau/reviewflow/commit/8da8c83c4c46f035eb756046ff4e3ebe814a2dac))
* **deps:** update dependency probot to v10.19.0 ([#135](https://github.com/christophehurpeau/reviewflow/issues/135)) ([0684361](https://github.com/christophehurpeau/reviewflow/commit/0684361d6c58536017f9958bd00e95d609b70688))
* **deps:** update react monorepo to v16.14.0 ([#137](https://github.com/christophehurpeau/reviewflow/issues/137)) ([e9f6a58](https://github.com/christophehurpeau/reviewflow/commit/e9f6a589e878cf7101b630a17c7057067051eaf9))

## [1.67.0](https://github.com/christophehurpeau/reviewflow/compare/v1.66.1...v1.67.0) (2020-12-19)


### Features

* add lockedPrNumber ([7b0f2d8](https://github.com/christophehurpeau/reviewflow/commit/7b0f2d8988e1cf614a526df60227f5c95f8b3f05))


### Bug Fixes

* revert change in ornikar config ([89c73b7](https://github.com/christophehurpeau/reviewflow/commit/89c73b72699ae56a3772d4a81fbc7ce5be9a40ea))

### [1.66.1](https://github.com/christophehurpeau/reviewflow/compare/v1.66.0...v1.66.1) (2020-12-19)


### Bug Fixes

* update label api ([9838dc1](https://github.com/christophehurpeau/reviewflow/commit/9838dc1355cd155bb6da75920ec3307072e70629))

## [1.66.0](https://github.com/christophehurpeau/reviewflow/compare/v1.65.0...v1.66.0) (2020-12-19)


### Features

* update merge emoji ([ca8782c](https://github.com/christophehurpeau/reviewflow/commit/ca8782c091000f53c9ec0ded0ebc4936e8deb6a9))


### Bug Fixes

* dont use context.payload.repository.owner but account instead ([e4dfdb3](https://github.com/christophehurpeau/reviewflow/commit/e4dfdb39200d825ad9533626f7f601ff2fbfca15))
* update conventional config link ([b954c1f](https://github.com/christophehurpeau/reviewflow/commit/b954c1f4a99ea044adfc70bd0d4e0c038ae76828))

## [1.65.0](https://github.com/christophehurpeau/reviewflow/compare/v1.64.0...v1.65.0) (2020-12-19)


### Features

* add GaelFerrand in ornikar config ([#121](https://github.com/christophehurpeau/reviewflow/issues/121)) ([d3f5584](https://github.com/christophehurpeau/reviewflow/commit/d3f5584b4860cfc17cf7f5e18cf2e9f8f1b72a7a))


### Bug Fixes

* logs ([89643ad](https://github.com/christophehurpeau/reviewflow/commit/89643ad01287c0ad2b5e6c58936e8e658c795ffc))
* missing return false when pr is not opened ([ac23426](https://github.com/christophehurpeau/reviewflow/commit/ac23426297426d215f6cf838934c571dbfba41b7))

# [1.64.0](https://github.com/christophehurpeau/reviewflow/compare/v1.63.0...v1.64.0) (2020-12-19)


### Features

* upgrade to probot 10 ([d11c7e1](https://github.com/christophehurpeau/reviewflow/commit/d11c7e1ea8ceb3cc10ef365436ad780c06ca3292))



# [1.63.0](https://github.com/christophehurpeau/reviewflow/compare/v1.62.0...v1.63.0) (2020-11-06)


### Features

* add loicleser in ornikar config ([d5a3a1d](https://github.com/christophehurpeau/reviewflow/commit/d5a3a1da2f80f0d095afaabea5ec940df231c65c))



# [1.62.0](https://github.com/christophehurpeau/reviewflow/compare/v1.61.0...v1.62.0) (2020-10-21)


### Features

* add new member in ornikar team ([32e6b4c](https://github.com/christophehurpeau/reviewflow/commit/32e6b4c0cbfa410a1c134a29f276cc16218c77ce))



# [1.61.0](https://github.com/christophehurpeau/reviewflow/compare/v1.60.0...v1.61.0) (2020-10-08)


### Features

* update ornikar members ([1ceb9d6](https://github.com/christophehurpeau/reviewflow/commit/1ceb9d6b40be58be786fbee6f54f541b8aa7a0d8))



# [1.60.0](https://github.com/christophehurpeau/reviewflow/compare/v1.59.1...v1.60.0) (2020-09-28)


### Features

* better support of suggestions comments ([051ae13](https://github.com/christophehurpeau/reviewflow/commit/051ae1373f34cc069c32f82e8a4c1544706421e7))



## [1.59.1](https://github.com/christophehurpeau/reviewflow/compare/v1.59.0...v1.59.1) (2020-09-25)


### Bug Fixes

* ignore creating labelIdToGroupName Map when repo is ignored ([3644d62](https://github.com/christophehurpeau/reviewflow/commit/3644d624f587b304627557515f39650246b8475c))
* ungreedy regexp for commment update ([fbd1024](https://github.com/christophehurpeau/reviewflow/commit/fbd102426eb7e325a4330cd2357c23fdc450e30c))



# [1.59.0](https://github.com/christophehurpeau/reviewflow/compare/v1.58.0...v1.59.0) (2020-09-20)


### Bug Fixes

* dont sync labels on ignored repos ([93363a3](https://github.com/christophehurpeau/reviewflow/commit/93363a35ab144a4a5aba1f505d0d3be27b5f08a5))


### Features

* new label to update branch ([60640ea](https://github.com/christophehurpeau/reviewflow/commit/60640ea795aa3c5503fbf7f61a86d94bd7e7da22))
* send slack notifications even for ignored repos ([cfd4d32](https://github.com/christophehurpeau/reviewflow/commit/cfd4d32d671b34ec82339ceeb232e12534aef3ba))
* update liwi-mongo with better typings ([c690a89](https://github.com/christophehurpeau/reviewflow/commit/c690a894f1351d8f52fe528b2c03d8c738645c60))



# [1.58.0](https://github.com/christophehurpeau/reviewflow/compare/v1.57.1...v1.58.0) (2020-08-11)


### Features

* add draft prs in slack app home ([f50d402](https://github.com/christophehurpeau/reviewflow/commit/f50d4028518d66569cfb2cf6144fb645c7e64d72))



## [1.57.1](https://github.com/christophehurpeau/reviewflow/compare/v1.57.0...v1.57.1) (2020-08-08)


### Bug Fixes

* rescheduling ([8e361f5](https://github.com/christophehurpeau/reviewflow/commit/8e361f53c82df9a545b9a2272e308279eb09b37e))



# [1.57.0](https://github.com/christophehurpeau/reviewflow/compare/v1.56.1...v1.57.0) (2020-08-05)


### Bug Fixes

* dont add needsReview if config says it doesnt requires review request ([533d790](https://github.com/christophehurpeau/reviewflow/commit/533d790b652dac721fe13640da9f29586c04d1b6))


### Features

* add option autoMergeRenovateWithSkipCi, now disabled by default ([09c0353](https://github.com/christophehurpeau/reviewflow/commit/09c03538c26835125b6e92ef1364a68edab3882d))
* also requires review request in reviewflow ([c16e353](https://github.com/christophehurpeau/reviewflow/commit/c16e3530aee0af87f12c56f0b0313d46a5ab1b8e))



## [1.56.1](https://github.com/christophehurpeau/reviewflow/compare/v1.56.0...v1.56.1) (2020-07-21)


### Bug Fixes

* use assignee instead of author ([328deba](https://github.com/christophehurpeau/reviewflow/commit/328deba8788ef2717deab627e48626b8a04e66f1))



# [1.56.0](https://github.com/christophehurpeau/reviewflow/compare/v1.55.1...v1.56.0) (2020-07-05)


### Features

* use comment instead of body for infos, options, commit notes ([5af7489](https://github.com/christophehurpeau/reviewflow/commit/5af7489e8616159729901043a6bb7faeb38fb531))



## [1.55.1](https://github.com/christophehurpeau/reviewflow/compare/v1.55.0...v1.55.1) (2020-06-04)


### Features

* add automerge log ([83d4d27](https://github.com/christophehurpeau/reviewflow/commit/83d4d271b257de036bd58de750d9ced8abadc5bf))
* increase reschedule timeout ([920eeda](https://github.com/christophehurpeau/reviewflow/commit/920eeda8645726468447bc6b7195dff0851fb417))



# [1.55.0](https://github.com/christophehurpeau/reviewflow/compare/v1.54.2...v1.55.0) (2020-05-29)


### Features

* add optional botUsers in config, check comment user ([0728acc](https://github.com/christophehurpeau/reviewflow/commit/0728acc7bbabec161f174b37408fea7cf0a55826))



## [1.54.2](https://github.com/christophehurpeau/reviewflow/compare/v1.54.1...v1.54.2) (2020-05-27)


### Bug Fixes

* **deps:** pin dependencies [skip ci] ([#98](https://github.com/christophehurpeau/reviewflow/issues/98)) ([fa4214e](https://github.com/christophehurpeau/reviewflow/commit/fa4214e1fd0034cef10fb0520f42256e32fb394a))



## [1.54.1](https://github.com/christophehurpeau/reviewflow/compare/v1.54.0...v1.54.1) (2020-05-27)


### Bug Fixes

* renovate changed its checkbox to <!-- rebase-check --> ([1d476e5](https://github.com/christophehurpeau/reviewflow/commit/1d476e5fcdef924eca68fa51889e2e24a2118e57))



# [1.54.0](https://github.com/christophehurpeau/reviewflow/compare/v1.53.0...v1.54.0) (2020-05-27)


### Features

* add special bot config ([2bdbe52](https://github.com/christophehurpeau/reviewflow/commit/2bdbe52b01e206aea7e120ab284b46631fa40061))



# [1.53.0](https://github.com/christophehurpeau/reviewflow/compare/v1.52.0...v1.53.0) (2020-05-27)


### Features

* also support unicode emojis ([6e9c7f8](https://github.com/christophehurpeau/reviewflow/commit/6e9c7f80270d985c2f7c53e069dff91b966fb41b))
* slackify markdown ([70ae698](https://github.com/christophehurpeau/reviewflow/commit/70ae698b6e251eb9df1c8c41ef0ed1df663d5f2f))



# [1.52.0](https://github.com/christophehurpeau/reviewflow/compare/v1.51.0...v1.52.0) (2020-05-25)


### Features

* add repo emoji ([9d76521](https://github.com/christophehurpeau/reviewflow/commit/9d76521e3855eff027678587f0b79882b00509d5))
* improve label option autoMergeWithSkipCi ([5cdab46](https://github.com/christophehurpeau/reviewflow/commit/5cdab467c910b05e80507f1d689495b452b15445))



# [1.51.0](https://github.com/christophehurpeau/reviewflow/compare/v1.50.0...v1.51.0) (2020-05-25)


### Features

* update slack home on pr closed/merged ([deaabdf](https://github.com/christophehurpeau/reviewflow/commit/deaabdfcb6a02d5c2f65b85c2b9eda992e589871))



# [1.50.0](https://github.com/christophehurpeau/reviewflow/compare/v1.49.0...v1.50.0) (2020-05-24)


### Bug Fixes

* double space ([bd0176c](https://github.com/christophehurpeau/reviewflow/commit/bd0176c0f766f02bfbd6b266e682fce99438ffdb))


### Features

* edit requested review message when pr was reviewed or request removed ([0bbbd67](https://github.com/christophehurpeau/reviewflow/commit/0bbbd67f6d754d2936c854b651724323edd435d7))



# [1.49.0](https://github.com/christophehurpeau/reviewflow/compare/v1.48.0...v1.49.0) (2020-05-24)


### Features

* diff comment vs reply ([9fd82f3](https://github.com/christophehurpeau/reviewflow/commit/9fd82f38eac764b2db61ccf52fa60533b3b79c33))



# [1.48.0](https://github.com/christophehurpeau/reviewflow/compare/v1.47.2...v1.48.0) (2020-05-24)


### Features

* deleted and edited comment sync ([c0dedeb](https://github.com/christophehurpeau/reviewflow/commit/c0dedebd6dcc3951a545bcab87759caa0bab3f4e))



## [1.47.2](https://github.com/christophehurpeau/reviewflow/compare/v1.47.1...v1.47.2) (2020-05-24)


### Bug Fixes

* redirect_uri strategy ([77b9286](https://github.com/christophehurpeau/reviewflow/commit/77b92863a75877c5648120a68efd74940aaeb20a))



## [1.47.1](https://github.com/christophehurpeau/reviewflow/compare/v1.47.0...v1.47.1) (2020-05-23)


### Bug Fixes

* feature branch merge should use default message ([f3f09b3](https://github.com/christophehurpeau/reviewflow/commit/f3f09b38fd23058bb6c68ed41e34d3011931b960))
* try to automerge when automerge label is added ([f49f2ce](https://github.com/christophehurpeau/reviewflow/commit/f49f2ce00bc25e4775fac5e8a1967e0c87e8b219))



# [1.47.0](https://github.com/christophehurpeau/reviewflow/compare/v1.46.2...v1.47.0) (2020-05-23)


### Features

* improve slack home and schedule updates to respect rate limits ([4dcce61](https://github.com/christophehurpeau/reviewflow/commit/4dcce61d7a31b4f400b7d40316ca4991381bf2fe))



## [1.46.2](https://github.com/christophehurpeau/reviewflow/compare/v1.46.1...v1.46.2) (2020-05-22)


### Bug Fixes

* prevent edit pr when only diff is newlines ([4467819](https://github.com/christophehurpeau/reviewflow/commit/44678190fa635b358817c159689594252dc9f5a9))



## [1.46.1](https://github.com/christophehurpeau/reviewflow/compare/v1.46.0...v1.46.1) (2020-05-22)


### Bug Fixes

* path home ([5ce6799](https://github.com/christophehurpeau/reviewflow/commit/5ce67995bc1383ef63ee188cfb0fcbbd8e9915d8))



# [1.46.0](https://github.com/christophehurpeau/reviewflow/compare/v1.45.1...v1.46.0) (2020-05-22)


### Bug Fixes

* account vs user vs org ([5e7b376](https://github.com/christophehurpeau/reviewflow/commit/5e7b376691c758fe04c4fdd8f5d2709bd49df44e))


### Features

* remove gh prefix in url ([4123975](https://github.com/christophehurpeau/reviewflow/commit/4123975c0ea220656148b3e04d9957395d308635))



## [1.45.1](https://github.com/christophehurpeau/reviewflow/compare/v1.45.0...v1.45.1) (2020-05-21)


### Bug Fixes

* insert org members ([b132601](https://github.com/christophehurpeau/reviewflow/commit/b132601f6c9c8d93e30b5ad4156c7e770586b93f))



# [1.45.0](https://github.com/christophehurpeau/reviewflow/compare/v1.43.0...v1.45.0) (2020-05-21)


### Features

* home ([dfc351c](https://github.com/christophehurpeau/reviewflow/commit/dfc351c4da754a9101d1e1f9684ca849d5cbdf55))



# [1.43.0](https://github.com/christophehurpeau/reviewflow/compare/v1.42.4...v1.43.0) (2020-05-21)


### Features

* support comments from issue_comment.created event ([a57f251](https://github.com/christophehurpeau/reviewflow/commit/a57f25191594183b251ab82a1e3c90f6dbbc3b54))



## [1.42.4](https://github.com/christophehurpeau/reviewflow/compare/v1.42.3...v1.42.4) (2020-05-21)


### Bug Fixes

* check mentions length ([8f0df74](https://github.com/christophehurpeau/reviewflow/commit/8f0df748f363e52a6710a2ac20f5b8958c2bc4cf))
* remove console.log ([46d78e4](https://github.com/christophehurpeau/reviewflow/commit/46d78e47df0ee05eaef2624a1ba7ec1a4aa7a264))
* reviews states and duplicate notifications ([d5544ca](https://github.com/christophehurpeau/reviewflow/commit/d5544caa9550e04c155c36cf84a55320e97ef407))



## [1.42.3](https://github.com/christophehurpeau/reviewflow/compare/v1.42.2...v1.42.3) (2020-05-21)


### Bug Fixes

* not unique team index ([5be15f7](https://github.com/christophehurpeau/reviewflow/commit/5be15f75f20dcfa20d293c6aa8a25582a60aeede))



## [1.42.2](https://github.com/christophehurpeau/reviewflow/compare/v1.42.1...v1.42.2) (2020-05-21)


### Bug Fixes

* sync teams on initial sync ([c1d8744](https://github.com/christophehurpeau/reviewflow/commit/c1d87440ba3b6f3e01cda25d989172e3cc02368a))



## [1.42.1](https://github.com/christophehurpeau/reviewflow/compare/v1.42.0...v1.42.1) (2020-05-21)



# [1.42.0](https://github.com/christophehurpeau/reviewflow/compare/v1.41.2...v1.42.0) (2020-05-21)


### Bug Fixes

* tsc ([5f2aa16](https://github.com/christophehurpeau/reviewflow/commit/5f2aa16a16dcc61192f4082e25f7b6bd09c4c21b))


### Features

* pr comment and settings ([#91](https://github.com/christophehurpeau/reviewflow/issues/91)) ([e631a42](https://github.com/christophehurpeau/reviewflow/commit/e631a42ad31e446b296593ece22ecf4a25ad9114))



## [1.41.2](https://github.com/christophehurpeau/reviewflow/compare/v1.41.1...v1.41.2) (2020-05-20)


### Bug Fixes

* paginate user list ([e192667](https://github.com/christophehurpeau/reviewflow/commit/e192667f9f9e7267eb5082c448431a8b84c8898a))



## [1.41.1](https://github.com/christophehurpeau/reviewflow/compare/v1.41.0...v1.41.1) (2020-05-20)


### Bug Fixes

* move ChibiBlasphem to right group ([800bb85](https://github.com/christophehurpeau/reviewflow/commit/800bb85de1b2e40472be6a1852c06f13604eaddf))



# [1.41.0](https://github.com/christophehurpeau/reviewflow/compare/v1.40.0...v1.41.0) (2020-05-11)


### Bug Fixes

* **deps:** pin dependencies ([#86](https://github.com/christophehurpeau/reviewflow/issues/86)) ([73537da](https://github.com/christophehurpeau/reviewflow/commit/73537da29fa46668e1a176c6b3b05dfe0e076d9a))


### Features

* add christopher ([f85a13f](https://github.com/christophehurpeau/reviewflow/commit/f85a13f7ca35549c19975a167d4c0dfe15155c90))



# [1.40.0](https://github.com/christophehurpeau/reviewflow/compare/v1.39.2...v1.40.0) (2020-05-02)


### Features

* add body review as attachment in slack message ([6a54ef7](https://github.com/christophehurpeau/reviewflow/commit/6a54ef79536c9887321e4dfd42ae2a823c278992))



## [1.39.2](https://github.com/christophehurpeau/reviewflow/compare/v1.39.1...v1.39.2) (2020-05-02)



## [1.39.1](https://github.com/christophehurpeau/reviewflow/compare/v1.39.0...v1.39.1) (2020-05-02)


### Bug Fixes

* redirect on / ([b8ef656](https://github.com/christophehurpeau/reviewflow/commit/b8ef656da8bfefbca334e79f572e770632816bfc))



# [1.39.0](https://github.com/christophehurpeau/reviewflow/compare/v1.38.0...v1.39.0) (2020-05-02)


### Features

* enable defaultconfig ([e0d6721](https://github.com/christophehurpeau/reviewflow/commit/e0d6721de7b988739471d7a5e38b587fef6e7f3a))



# [1.38.0](https://github.com/christophehurpeau/reviewflow/compare/v1.37.1...v1.38.0) (2020-05-02)


### Bug Fixes

* paginate migration from .paginate(promise) to .paginate(endpointOptions) ([87ebf29](https://github.com/christophehurpeau/reviewflow/commit/87ebf297743fcab9e42f0ea5ea4e3a05a016480b))
* remaining rename pull_number and issue_number ([fc1c5c3](https://github.com/christophehurpeau/reviewflow/commit/fc1c5c31268e0fa883e2050a3420835228c4234b))


### Features

* better log repo ([fad050a](https://github.com/christophehurpeau/reviewflow/commit/fad050af409f8c64a4a2205329f9a3e4598b7ef5))



## [1.37.1](https://github.com/christophehurpeau/reviewflow/compare/v1.37.0...v1.37.1) (2020-05-02)


### Bug Fixes

* deprecated warnings on number parameter ([e57e0d6](https://github.com/christophehurpeau/reviewflow/commit/e57e0d6f7d7c42dde38a73540a2e35f041948f0a))



# [1.37.0](https://github.com/christophehurpeau/reviewflow/compare/v1.36.0...v1.37.0) (2020-05-02)


### Bug Fixes

* app router paths ([c3452c4](https://github.com/christophehurpeau/reviewflow/commit/c3452c46137a9cc79d7357c0e7923f9b6d7b5283))


### Features

* default config ([85fd768](https://github.com/christophehurpeau/reviewflow/commit/85fd76845a3c0553c4747dcb8b84529a0fa0c655))



# [1.36.0](https://github.com/christophehurpeau/reviewflow/compare/v1.35.0...v1.36.0) (2020-04-27)


### Features

* support number inside ticket key ([1e2a87a](https://github.com/christophehurpeau/reviewflow/commit/1e2a87a696c7e85b637952806cb4fb64ce0ba041))



# [1.35.0](https://github.com/christophehurpeau/reviewflow/compare/v1.34.0...v1.35.0) (2020-03-11)


### Features

* add busser in ops team ([0ebf1b8](https://github.com/christophehurpeau/reviewflow/commit/0ebf1b8800183c9d704e49d6de4bcc7f619c9e3a))



# [1.34.0](https://github.com/christophehurpeau/reviewflow/compare/v1.33.0...v1.34.0) (2020-02-23)


### Features

* addn pr number in reschedule ([5613bd5](https://github.com/christophehurpeau/reviewflow/commit/5613bd538801a876bb28c074c8e9402a2af3702f))



# [1.33.0](https://github.com/christophehurpeau/reviewflow/compare/v1.32.0...v1.33.0) (2020-02-23)


### Bug Fixes

* shouldIgnoreRepo ([d99430e](https://github.com/christophehurpeau/reviewflow/commit/d99430e0a7240d8465709b88215b946aad2fccdf))
* **deps:** update dependency probot to v9.9.4 ([#70](https://github.com/christophehurpeau/reviewflow/issues/70)) ([2f1dd26](https://github.com/christophehurpeau/reviewflow/commit/2f1dd2632f4469236c47a0defab4a6e3d704b5ab))


### Features

* add first test on opened PR ([bf856df](https://github.com/christophehurpeau/reviewflow/commit/bf856df9ff3778eb8d8583ae15b15556d51a5404))


### Reverts

* Revert "Revert "fix: prevent rescheduling for loading state status webhook"" ([6a427e7](https://github.com/christophehurpeau/reviewflow/commit/6a427e7872f56d1aede4b7c4914afa1cfcef5285))



# [1.32.0](https://github.com/christophehurpeau/reviewflow/compare/v1.31.1...v1.32.0) (2020-02-03)


### Features

* ornikar config ignore devenv repo ([051de98](https://github.com/christophehurpeau/reviewflow/commit/051de98d53fcdaa29f9a9a3dccecbc713e0a49a3))



## [1.31.1](https://github.com/christophehurpeau/reviewflow/compare/v1.31.0...v1.31.1) (2020-02-03)


### Bug Fixes

* enable description check now that github fixed issue ([bbc51e4](https://github.com/christophehurpeau/reviewflow/commit/bbc51e4a56079700ffb62d04b2d81247a8b96717))



# [1.31.0](https://github.com/christophehurpeau/reviewflow/compare/v1.30.0...v1.31.0) (2020-02-03)


### Bug Fixes

* teams/ops label migration ([5e43d40](https://github.com/christophehurpeau/reviewflow/commit/5e43d4041515bd65f831d7f63cf7879246e91d26))


### Features

* add more labels to sync in ornikar config ([d4deefa](https://github.com/christophehurpeau/reviewflow/commit/d4deefa3862a6f02c5088344e9db772f1ed709b6))
* sync more labels ([95916b5](https://github.com/christophehurpeau/reviewflow/commit/95916b5388fdba3677f679c1f3db522bc854c9ae))



# [1.30.0](https://github.com/christophehurpeau/reviewflow/compare/v1.29.0...v1.30.0) (2020-01-24)


### Features

* rename ornikar ops team and add two members ([0c6c334](https://github.com/christophehurpeau/reviewflow/commit/0c6c334a8f9dbdf5170159a03ea4dab7a97333bf))



# [1.29.0](https://github.com/christophehurpeau/reviewflow/compare/v1.28.0...v1.29.0) (2019-12-09)


### Features

* add Radyum in ornikar config ([e2a63c1](https://github.com/christophehurpeau/reviewflow/commit/e2a63c14606630511496895a22a78bd0bb65475d))


### Reverts

* Revert "chore(deps): update dependency husky to v3 (#71)" (#76) ([0b10c8c](https://github.com/christophehurpeau/reviewflow/commit/0b10c8ce091532c0a360e6ca463d124646619568)), closes [#71](https://github.com/christophehurpeau/reviewflow/issues/71) [#76](https://github.com/christophehurpeau/reviewflow/issues/76)



# [1.28.0](https://github.com/christophehurpeau/reviewflow/compare/v1.27.0...v1.28.0) (2019-10-24)


### Features

* add alexis to team design ([ef73ec1](https://github.com/christophehurpeau/reviewflow/commit/ef73ec12508e9270ac8511b6a5a5b68616d61650))



# [1.27.0](https://github.com/christophehurpeau/reviewflow/compare/v1.26.0...v1.27.0) (2019-10-03)


### Features

* add lena ([b8e37ce](https://github.com/christophehurpeau/reviewflow/commit/b8e37ceb7de8c7b57d9add09f35b4d5a962c64af))



# [1.26.0](https://github.com/christophehurpeau/reviewflow/compare/v1.25.0...v1.26.0) (2019-10-02)


### Features

* add 2 new frontends ([fef3f48](https://github.com/christophehurpeau/reviewflow/commit/fef3f488d4ef6ffbb9fb1fcdbff0f6a4cba16ab1))



# [1.25.0](https://github.com/christophehurpeau/reviewflow/compare/v1.24.6...v1.25.0) (2019-09-20)


### Features

* new config option ignoreRepoPattern ([669c0f9](https://github.com/christophehurpeau/reviewflow/commit/669c0f9970c5ce23ee85a9b8c48377c7cd100b84))



## [1.24.6](https://github.com/christophehurpeau/reviewflow/compare/v1.24.5...v1.24.6) (2019-09-16)


### Bug Fixes

* detect uppercase no issue ([b8c6aec](https://github.com/christophehurpeau/reviewflow/commit/b8c6aec3c48824ee1a385b894813cb28c20018f6))



## [1.24.5](https://github.com/christophehurpeau/reviewflow/compare/v1.24.4...v1.24.5) (2019-09-06)


### Bug Fixes

* on sync event, remove failed status on previous sha ([142085f](https://github.com/christophehurpeau/reviewflow/commit/142085f5d801e613100d5f1dadf7c422102e2273))



## [1.24.4](https://github.com/christophehurpeau/reviewflow/compare/v1.24.3...v1.24.4) (2019-09-04)


### Bug Fixes

* automerge label not found ([65af12c](https://github.com/christophehurpeau/reviewflow/commit/65af12c803382f6258ee05e4aeb1f5105f73bef0))



## [1.24.3](https://github.com/christophehurpeau/reviewflow/compare/v1.24.2...v1.24.3) (2019-09-02)


### Bug Fixes

* missing toAddNames.add in updateReviewStatus for teams ([9b54591](https://github.com/christophehurpeau/reviewflow/commit/9b54591d7a444944bc74d300e40f2993ebec2460))



## [1.24.2](https://github.com/christophehurpeau/reviewflow/compare/v1.24.1...v1.24.2) (2019-09-02)


### Bug Fixes

* catch 404 remove non existing label ([255aecf](https://github.com/christophehurpeau/reviewflow/commit/255aecf86b5333b6302b7255f8a38f92aa929a69))
* use cleaned title for match ([ab08b75](https://github.com/christophehurpeau/reviewflow/commit/ab08b756e3c906276a142ba7076474aff98f7877))



## [1.24.1](https://github.com/christophehurpeau/reviewflow/compare/v1.24.0...v1.24.1) (2019-08-29)


### Bug Fixes

* repo ignored only display owner login ([27d6dda](https://github.com/christophehurpeau/reviewflow/commit/27d6dda04224846d05db504330323427364c1b85))



# [1.24.0](https://github.com/christophehurpeau/reviewflow/compare/v1.23.1...v1.24.0) (2019-08-29)


### Bug Fixes

* force reviewflow name as username in slack ([2b3b898](https://github.com/christophehurpeau/reviewflow/commit/2b3b898e39e4ff443cae054e0ed3fa175f13839b))


### Features

* add breaking changes info ([29b771e](https://github.com/christophehurpeau/reviewflow/commit/29b771e510514651a11ebf3775f3db3e32a5bdcb))
* improve pr link ([a4812c6](https://github.com/christophehurpeau/reviewflow/commit/a4812c682ff56e4943e3d5bf34c716913b32baf0))



## [1.23.1](https://github.com/christophehurpeau/reviewflow/compare/v1.23.0...v1.23.1) (2019-08-24)


### Bug Fixes

* missing arg in closed event ([cce63b1](https://github.com/christophehurpeau/reviewflow/commit/cce63b1e691d2823190655f2ac62e86d862e6388))
* renovate label could not merge ([3345e2b](https://github.com/christophehurpeau/reviewflow/commit/3345e2b1f60c9efd7644b6aa28f06c3794dde6be))
* skip ci label to ensure it stays after renovate rebase ([90f1375](https://github.com/christophehurpeau/reviewflow/commit/90f137557d85473cecee0f5c67f76385da39f496))



# [1.23.0](https://github.com/christophehurpeau/reviewflow/compare/v1.22.0...v1.23.0) (2019-08-24)


### Bug Fixes

* missing types jest ([4f2f188](https://github.com/christophehurpeau/reviewflow/commit/4f2f18814a57a3a5ae7be9cf839a0f8424e0c295))


### Features

* add app router and github login ([84ff532](https://github.com/christophehurpeau/reviewflow/commit/84ff532b6673c451569fd85fb8423f4e5e3f9a97))



# [1.22.0](https://github.com/christophehurpeau/reviewflow/compare/v1.21.0...v1.22.0) (2019-08-13)


### Features

* add juliano and archi team ([280aa9e](https://github.com/christophehurpeau/reviewflow/commit/280aa9e0643f872e69dddc9896d1d8a3761c05eb))



# [1.21.0](https://github.com/christophehurpeau/reviewflow/compare/v1.20.9...v1.21.0) (2019-08-09)


### Bug Fixes

* avoid overriding labels ([a4f3381](https://github.com/christophehurpeau/reviewflow/commit/a4f3381eaf9a9eb112d6d77907808145d636bf3c))


### Features

* support all jira formats ([fbd8304](https://github.com/christophehurpeau/reviewflow/commit/fbd830446d92af2a0669d62486993d438396880c))



## [1.20.9](https://github.com/christophehurpeau/reviewflow/compare/v1.20.8...v1.20.9) (2019-08-06)


### Bug Fixes

* add needsReview label in renovate pr that are not automerged ([2247461](https://github.com/christophehurpeau/reviewflow/commit/2247461e5ac045c90a8ef0ed48ed03a30f11187f))
* **deps:** update dependency @slack/web-api to v5.1.0 ([#62](https://github.com/christophehurpeau/reviewflow/issues/62)) ([e4417dc](https://github.com/christophehurpeau/reviewflow/commit/e4417dca30610d722166254fd163d79b410baf0e))



## [1.20.8](https://github.com/christophehurpeau/reviewflow/compare/v1.20.7...v1.20.8) (2019-07-16)


### Bug Fixes

* use pr title when body no longer have the checkbox ([0b56dd2](https://github.com/christophehurpeau/reviewflow/commit/0b56dd20f13c50037be1d904f2cb0b94b057d7af))



## [1.20.7](https://github.com/christophehurpeau/reviewflow/compare/v1.20.6...v1.20.7) (2019-07-11)


### Bug Fixes

* ensure [skip-ci] exists when automatic automerge from renovate ([badd77b](https://github.com/christophehurpeau/reviewflow/commit/badd77bf4c82d9386d83c88e0c0fe2b9e3561378))



## [1.20.6](https://github.com/christophehurpeau/reviewflow/compare/v1.20.5...v1.20.6) (2019-07-08)


### Bug Fixes

* remove pr from automerge queue when pr is missing approval ([309c42f](https://github.com/christophehurpeau/reviewflow/commit/309c42f9d57aaf4753a89e106586aba17ff24887))



## [1.20.5](https://github.com/christophehurpeau/reviewflow/compare/v1.20.4...v1.20.5) (2019-07-02)


### Bug Fixes

* update valerian's login ([e4d70a4](https://github.com/christophehurpeau/reviewflow/commit/e4d70a42ade588b83c3d23bbae30d9c60e36ae04))



## [1.20.4](https://github.com/christophehurpeau/reviewflow/compare/v1.20.3...v1.20.4) (2019-06-28)


### Bug Fixes

* use skipAutoMerge ([4bf9c0a](https://github.com/christophehurpeau/reviewflow/commit/4bf9c0aa53dbc3bad3efd6a5e11c6af4af4eab8e))



## [1.20.3](https://github.com/christophehurpeau/reviewflow/compare/v1.20.2...v1.20.3) (2019-06-28)


### Bug Fixes

* remove automerge from queue if case is unchecked ([8601e00](https://github.com/christophehurpeau/reviewflow/commit/8601e008170e16ce3128f7a6feec7a2b8b44fa44))
* skipAutoMerge when edittOpenedPR already call the method ([241fb0d](https://github.com/christophehurpeau/reviewflow/commit/241fb0decf17b8d0737d8f28873fe266e747314a))



## [1.20.2](https://github.com/christophehurpeau/reviewflow/compare/v1.20.1...v1.20.2) (2019-06-27)


### Bug Fixes

* bring back automerge on open ([8b5fcb9](https://github.com/christophehurpeau/reviewflow/commit/8b5fcb97c13fdd8b5beed5522c69cef42ede744d))
* dont ignore renovate edits on prs ([a24e13e](https://github.com/christophehurpeau/reviewflow/commit/a24e13edd77b738f6c71891094e967d9e8ae4ee6))



## [1.20.1](https://github.com/christophehurpeau/reviewflow/compare/v1.20.0...v1.20.1) (2019-06-26)


### Bug Fixes

* githubLoginToTeams ([7ad44f0](https://github.com/christophehurpeau/reviewflow/commit/7ad44f04d499f5b3a2924afd64c6ad3805334ae3))



# [1.20.0](https://github.com/christophehurpeau/reviewflow/compare/v1.19.7...v1.20.0) (2019-06-26)


### Bug Fixes

* ignore edits from bots ([dc944ab](https://github.com/christophehurpeau/reviewflow/commit/dc944abdb5813a93b8503b2bccfb5a458abe8a8a))
* use autoMergeWithSkipCi when merge is auto approved to avoid unwanted deployments ([2f36630](https://github.com/christophehurpeau/reviewflow/commit/2f36630d7a33cc77926cc6bd2641a8d3dd907f5b))


### Features

* orgs and teams ([0c8974f](https://github.com/christophehurpeau/reviewflow/commit/0c8974f6d9a23772b3782ba0ec55b4f59a855e23))
* simplify updatePrBody ([649fd81](https://github.com/christophehurpeau/reviewflow/commit/649fd81c6308788daa5d23571c1e2256b8096a6e))



## [1.19.7](https://github.com/christophehurpeau/reviewflow/compare/v1.19.6...v1.19.7) (2019-06-26)


### Bug Fixes

* removePrFromAutomergeQueue ([35b818a](https://github.com/christophehurpeau/reviewflow/commit/35b818a4b89bdd8def94e33ba90c4f9370c5accb))
* support endings, for renovate body for example ([9c3c0fb](https://github.com/christophehurpeau/reviewflow/commit/9c3c0fb07cbb7e6e5c3df5e8357d099bfaf9e9d1))



## [1.19.6](https://github.com/christophehurpeau/reviewflow/compare/v1.19.5...v1.19.6) (2019-06-11)


### Bug Fixes

* ensure pr number is always compared as string ([a10bfbc](https://github.com/christophehurpeau/reviewflow/commit/a10bfbcfe7dd3233311fdded79d1877338531e58))



## [1.19.5](https://github.com/christophehurpeau/reviewflow/compare/v1.19.4...v1.19.5) (2019-06-11)


### Bug Fixes

* remove queued pr when pr is closed ([b86e733](https://github.com/christophehurpeau/reviewflow/commit/b86e7338a917d679da5aaa2dbfc071febe3fce58))



## [1.19.4](https://github.com/christophehurpeau/reviewflow/compare/v1.19.3...v1.19.4) (2019-06-10)


### Bug Fixes

* labels change only take events from non bot or renovate bot ([dc22e05](https://github.com/christophehurpeau/reviewflow/commit/dc22e05385a372328ca10297e540f2395bc621ff))



## [1.19.3](https://github.com/christophehurpeau/reviewflow/compare/v1.19.2...v1.19.3) (2019-05-28)


### Bug Fixes

* still try to automerge when pr is closed ([70af724](https://github.com/christophehurpeau/reviewflow/commit/70af7241270b549fc0de818da602b899e33fe398))



## [1.19.2](https://github.com/christophehurpeau/reviewflow/compare/v1.19.1...v1.19.2) (2019-05-27)


### Bug Fixes

* label change featurebranch vs automerge ([bda6aed](https://github.com/christophehurpeau/reviewflow/commit/bda6aedd9d651aff0154ca44c046b2c4695fccb5))



## [1.19.1](https://github.com/christophehurpeau/reviewflow/compare/v1.19.0...v1.19.1) (2019-05-25)


### Bug Fixes

* missing reviewflow status on renovate pr ([e71d725](https://github.com/christophehurpeau/reviewflow/commit/e71d725f8dfeacc61b2686a4b8c1811a56afdea5))
* prevent multiple approve on renovate prs ([40ef01d](https://github.com/christophehurpeau/reviewflow/commit/40ef01d784c2fe7539036f490ce1cb3814d2df76))



# [1.19.0](https://github.com/christophehurpeau/reviewflow/compare/v1.18.2...v1.19.0) (2019-05-25)


### Bug Fixes

* bring back jira-issue link ([f9dc926](https://github.com/christophehurpeau/reviewflow/commit/f9dc926b157b90a52f97e081d3831a503584bfc7))


### Features

* add option autoMerge ([e418623](https://github.com/christophehurpeau/reviewflow/commit/e418623b1fed10c12a893601c0dd8397564f22af))
* add option autoMerge ([534436a](https://github.com/christophehurpeau/reviewflow/commit/534436ad84bd6efa6f44819caec77f130c722fa4))
* add option autoMergeWithSkipCi ([bb76ec5](https://github.com/christophehurpeau/reviewflow/commit/bb76ec5202537459ca053a7c7d6f765d889e9afa))
* feature-branch label sync with options ([f0558d4](https://github.com/christophehurpeau/reviewflow/commit/f0558d44511de36757d2ef9fbd6245b14e5af011))
* sync feature-branch label ([278aa6f](https://github.com/christophehurpeau/reviewflow/commit/278aa6fbb4dbb2e1d244219772f727b508a966e8))
* sync feature-branch label with tag ([0f47044](https://github.com/christophehurpeau/reviewflow/commit/0f47044c040235b0800dcdbfe3224f5e6eeb60ee))



## [1.18.2](https://github.com/christophehurpeau/reviewflow/compare/v1.18.1...v1.18.2) (2019-05-25)


### Bug Fixes

* renovate adds labels after opening pr ([5bc57e0](https://github.com/christophehurpeau/reviewflow/commit/5bc57e0760db4cd41617e1bb054be7436fa1cdbe))



## [1.18.1](https://github.com/christophehurpeau/reviewflow/compare/v1.18.0...v1.18.1) (2019-05-22)


### Bug Fixes

* only need code/approved on renovate pr open to trigger automerge ([75490f1](https://github.com/christophehurpeau/reviewflow/commit/75490f1c779f575bc03534b23b8a1d6957ff1a26))



# [1.18.0](https://github.com/christophehurpeau/reviewflow/compare/v1.17.1...v1.18.0) (2019-05-22)


### Bug Fixes

* autoApproveAndAutoMerge after pr opened when from renovate ([e6b7e08](https://github.com/christophehurpeau/reviewflow/commit/e6b7e0808d36ef929d7f5628024ed0b41b2ae9f5))
* **deps:** update dependency probot to v9.2.11 ([#56](https://github.com/christophehurpeau/reviewflow/issues/56)) ([4ca9378](https://github.com/christophehurpeau/reviewflow/commit/4ca9378dc82d2c44453ed6c390dfc8e49436981e))


### Features

* add pixy in ornikar config ([d6be52e](https://github.com/christophehurpeau/reviewflow/commit/d6be52ee3857f4c37245763c01ad2424f3d4f6e4))
* auto approve when from renovate ([a70a549](https://github.com/christophehurpeau/reviewflow/commit/a70a549f94e26e7599b74259431e64072755041c))
* ornikar remove jira-issue status ([35f110f](https://github.com/christophehurpeau/reviewflow/commit/35f110fe22483d7374e69aef37d652d72081fa57))



## [1.17.1](https://github.com/christophehurpeau/reviewflow/compare/v1.17.0...v1.17.1) (2019-05-21)


### Reverts

* Revert "feat: pr from bot jira-issue" ([f0b3b35](https://github.com/christophehurpeau/reviewflow/commit/f0b3b35e0fa2b76ef7dde98130bf3dc6a6b1e63b))



# [1.17.0](https://github.com/christophehurpeau/reviewflow/compare/v1.16.0...v1.17.0) (2019-05-20)


### Features

* pr from bot jira-issue ([f2441fd](https://github.com/christophehurpeau/reviewflow/commit/f2441fd704702d5faf49a11102336b4415ddb99d))



# [1.16.0](https://github.com/christophehurpeau/reviewflow/compare/v1.15.2...v1.16.0) (2019-05-20)


### Features

* optional review when pr came from renovate ([0561ec3](https://github.com/christophehurpeau/reviewflow/commit/0561ec3cb6153b5e1a521ff7db0750ce0dcf73b1))



## [1.15.2](https://github.com/christophehurpeau/reviewflow/compare/v1.15.1...v1.15.2) (2019-05-07)


### Bug Fixes

* call autoMergeIfPossible on synchronize ([36edd20](https://github.com/christophehurpeau/reviewflow/commit/36edd20f246ef7b1afa607af26305852f1e02f7c))
* only edit changed fields in pr ([02b4385](https://github.com/christophehurpeau/reviewflow/commit/02b4385b8de21acf93b55f4e2332376da95c05a0))



## [1.15.1](https://github.com/christophehurpeau/reviewflow/compare/v1.15.0...v1.15.1) (2019-05-03)


### Bug Fixes

* auto merge when need to update branch ([f7809df](https://github.com/christophehurpeau/reviewflow/commit/f7809df9241cdfd457d7c45e75c912c49c92553f))



# [1.15.0](https://github.com/christophehurpeau/reviewflow/compare/v1.14.0...v1.15.0) (2019-05-03)


### Bug Fixes

* use combined status ([9b2c876](https://github.com/christophehurpeau/reviewflow/commit/9b2c876fa0ca7673f8954d9202aba14533bb8b09))


### Features

* add tilap in teamconfig ([423935f](https://github.com/christophehurpeau/reviewflow/commit/423935fce563315703099dcf00cb06245cd500d6))
* ignore repo reviewflow-test when name is not reviewflow-test ([a6b58d4](https://github.com/christophehurpeau/reviewflow/commit/a6b58d408b28f492dd33dd88a71b4af86bb3f870))
* remove label merge/delete-branch ([0eaaf0e](https://github.com/christophehurpeau/reviewflow/commit/0eaaf0ed88bc6fa32ca7d27363396e99d8ce4234))



# [1.14.0](https://github.com/christophehurpeau/reviewflow/compare/v1.13.0...v1.14.0) (2019-05-02)


### Bug Fixes

* **deps:** update dependency @slack/web-api to v5.0.1 ([#48](https://github.com/christophehurpeau/reviewflow/issues/48)) ([1342cb7](https://github.com/christophehurpeau/reviewflow/commit/1342cb73f8f1b1d1dc2887975391eae9f21374a3))


### Features

* add 2 members in ornikar team ([411ae2a](https://github.com/christophehurpeau/reviewflow/commit/411ae2a84021cca5777100d22485dd2155b817a5))



# [1.13.0](https://github.com/christophehurpeau/reviewflow/compare/v1.12.0...v1.13.0) (2019-04-26)


### Features

* support simplier template ([4e8c276](https://github.com/christophehurpeau/reviewflow/commit/4e8c276325415a16ed3891abaf5fe678870e65d3))



# [1.12.0](https://github.com/christophehurpeau/reviewflow/compare/v1.11.0...v1.12.0) (2019-04-24)


### Bug Fixes

* test ([7437b66](https://github.com/christophehurpeau/reviewflow/commit/7437b66c4e1297f3c1cc9433545cc683bc68f0fd))


### Features

* support space and lowercase in ONK ([bbdbf59](https://github.com/christophehurpeau/reviewflow/commit/bbdbf5905fcb64e9a94da9ed99d7856d1acd8699))



# [1.11.0](https://github.com/christophehurpeau/reviewflow/compare/v1.10.1...v1.11.0) (2019-04-24)


### Features

* add more log when automerged removed from status/check failed ([2020480](https://github.com/christophehurpeau/reviewflow/commit/20204807774f07e1fa33bb2e2eb6f44a519e2ff7))



## [1.10.1](https://github.com/christophehurpeau/reviewflow/compare/v1.10.0...v1.10.1) (2019-04-23)


### Bug Fixes

* automerge blocked status ([1d977ce](https://github.com/christophehurpeau/reviewflow/commit/1d977ced03ec92bd979fac70dd8258091017e442))



# [1.10.0](https://github.com/christophehurpeau/reviewflow/compare/v1.9.20...v1.10.0) (2019-04-22)


### Features

* pr parse body and auto delete branch and feature branch ([7b78e3c](https://github.com/christophehurpeau/reviewflow/commit/7b78e3ca69c2b0130374e953cdef2d814d5181c8))



## [1.9.20](https://github.com/christophehurpeau/reviewflow/compare/v1.9.19...v1.9.20) (2019-04-14)


### Bug Fixes

* allow to merge when unstable, when jobs are in hold in circleci ([7bc1948](https://github.com/christophehurpeau/reviewflow/commit/7bc19484e50c64dd60031795b8dc0abaef968f4b))



## [1.9.19](https://github.com/christophehurpeau/reviewflow/compare/v1.9.18...v1.9.19) (2019-04-14)


### Bug Fixes

* rescheduling when unstable ([c0dd749](https://github.com/christophehurpeau/reviewflow/commit/c0dd74954971d8ee9feaacd11ba2d430b45399f2))



## [1.9.18](https://github.com/christophehurpeau/reviewflow/compare/v1.9.17...v1.9.18) (2019-04-14)


### Bug Fixes

* reschedule when fail ([4cd4d04](https://github.com/christophehurpeau/reviewflow/commit/4cd4d042635f49fb2b185a861e7edfa08341d0aa))



## [1.9.17](https://github.com/christophehurpeau/reviewflow/compare/v1.9.16...v1.9.17) (2019-04-14)


### Bug Fixes

* prevent merge when mergeable_state is not clean (like unstable) ([f0342c1](https://github.com/christophehurpeau/reviewflow/commit/f0342c15f50c690c5c513b9da7c0211a8456364e))



## [1.9.16](https://github.com/christophehurpeau/reviewflow/compare/v1.9.15...v1.9.16) (2019-04-14)


### Bug Fixes

* support status ([418fa10](https://github.com/christophehurpeau/reviewflow/commit/418fa103a3ec68e4db7a73eb4abf426082f66005))



## [1.9.15](https://github.com/christophehurpeau/reviewflow/compare/v1.9.14...v1.9.15) (2019-04-14)


### Bug Fixes

* mergeable_state === behind doesnt mean not mergeable - except it is ([a822bd8](https://github.com/christophehurpeau/reviewflow/commit/a822bd8e6b5c69553f6e7d6f1814394391ade06d))



## [1.9.14](https://github.com/christophehurpeau/reviewflow/compare/v1.9.13...v1.9.14) (2019-04-14)


### Bug Fixes

* release lock when pr is already merged ([68b91df](https://github.com/christophehurpeau/reviewflow/commit/68b91dfedb1728a61105f6ecac6c6805a6d0af39))



## [1.9.13](https://github.com/christophehurpeau/reviewflow/compare/v1.9.12...v1.9.13) (2019-04-14)


### Bug Fixes

* pr result and pr id ([672be5b](https://github.com/christophehurpeau/reviewflow/commit/672be5b2a953183f8f73927576755f27e33d3fbb))
* pr result and pr id ([e90a150](https://github.com/christophehurpeau/reviewflow/commit/e90a15090e265dfdca01c760cb58939439f9ec27))



## [1.9.12](https://github.com/christophehurpeau/reviewflow/compare/v1.9.11...v1.9.12) (2019-04-14)


### Bug Fixes

* mergeable state ([1907bd9](https://github.com/christophehurpeau/reviewflow/commit/1907bd95ec1ab2c60f235e279fa5a83df94ac470))



## [1.9.11](https://github.com/christophehurpeau/reviewflow/compare/v1.9.10...v1.9.11) (2019-04-14)


### Bug Fixes

* lock merge before doing anything in autoMergeIfPossible ([6347758](https://github.com/christophehurpeau/reviewflow/commit/6347758b5fbdfa7b1aa83dec7da1b80818d36bca))



## [1.9.10](https://github.com/christophehurpeau/reviewflow/compare/v1.9.9...v1.9.10) (2019-04-14)


### Bug Fixes

* return false when reschueduling ([cc965bb](https://github.com/christophehurpeau/reviewflow/commit/cc965bb3c6ee805dcad506f952c708c26343bafb))



## [1.9.9](https://github.com/christophehurpeau/reviewflow/compare/v1.9.8...v1.9.9) (2019-04-14)


### Bug Fixes

* use status and checks to determine if pr should be unlocked ([bdf7ce6](https://github.com/christophehurpeau/reviewflow/commit/bdf7ce603637f4e0f96b845182475b5fd589a381))



## [1.9.8](https://github.com/christophehurpeau/reviewflow/compare/v1.9.7...v1.9.8) (2019-04-14)


### Bug Fixes

* pr number when edit renovate pr body ([96ecbd1](https://github.com/christophehurpeau/reviewflow/commit/96ecbd1c29c6c37ea7dd4d8084d9f6a70ef81de3))



## [1.9.7](https://github.com/christophehurpeau/reviewflow/compare/v1.9.6...v1.9.7) (2019-04-14)


### Bug Fixes

* error when trying to lock same number ([0198901](https://github.com/christophehurpeau/reviewflow/commit/019890158f6865162bfb88af8a4d2b8cddfb87b0))



## [1.9.6](https://github.com/christophehurpeau/reviewflow/compare/v1.9.5...v1.9.6) (2019-04-14)


### Bug Fixes

* locked pr forever ([429b129](https://github.com/christophehurpeau/reviewflow/commit/429b1294903f12ecf174c000309195d6735b0ece))



## [1.9.5](https://github.com/christophehurpeau/reviewflow/compare/v1.9.4...v1.9.5) (2019-04-14)


### Bug Fixes

* use pr.number ([1774dde](https://github.com/christophehurpeau/reviewflow/commit/1774ddeeea7b08b7793a6a1b0025714f041d319a))



## [1.9.4](https://github.com/christophehurpeau/reviewflow/compare/v1.9.3...v1.9.4) (2019-04-14)


### Bug Fixes

* unlock after merge ([87af768](https://github.com/christophehurpeau/reviewflow/commit/87af7682fbcb02453b0b5c2309706da6a7f67b7a))



## [1.9.3](https://github.com/christophehurpeau/reviewflow/compare/v1.9.2...v1.9.3) (2019-04-14)



## [1.9.2](https://github.com/christophehurpeau/reviewflow/compare/v1.9.1...v1.9.2) (2019-04-14)


### Bug Fixes

* release merge when merge fails ([21cbb07](https://github.com/christophehurpeau/reviewflow/commit/21cbb0777f7c5d3340824da1ac4db52bc5bb90e2))



## [1.9.1](https://github.com/christophehurpeau/reviewflow/compare/v1.9.0...v1.9.1) (2019-04-14)


### Bug Fixes

* use checkbox to rebase renovate pr ([b0d2516](https://github.com/christophehurpeau/reviewflow/commit/b0d25166dc03b89d9a8ad83c8db67bb277acf039))



# [1.9.0](https://github.com/christophehurpeau/reviewflow/compare/v1.8.1...v1.9.0) (2019-04-14)


### Bug Fixes

* **deps:** update dependency probot to v9.2.0 ([#44](https://github.com/christophehurpeau/reviewflow/issues/44)) ([64bf7f6](https://github.com/christophehurpeau/reviewflow/commit/64bf7f60cf79421e2b1ead71b010b1de815e4e47))


### Features

* smaller error messages ([04c60c9](https://github.com/christophehurpeau/reviewflow/commit/04c60c9f7a3a12a2aae4f37a3fd800ea5776dd97))
* support automerge lock and queue ([ed8eb2b](https://github.com/christophehurpeau/reviewflow/commit/ed8eb2bb36d88d95b735068ae9c2c17769f0e6b3))



## [1.8.1](https://github.com/christophehurpeau/reviewflow/compare/v1.8.0...v1.8.1) (2019-04-04)


### Bug Fixes

* date ([fab13dd](https://github.com/christophehurpeau/reviewflow/commit/fab13dd2dc5d01338f291fe0d7398ecce6399bf9))



# [1.8.0](https://github.com/christophehurpeau/reviewflow/compare/v1.7.0...v1.8.0) (2019-04-03)


### Features

* improve reviewflow error status ([7ff2078](https://github.com/christophehurpeau/reviewflow/commit/7ff207864bc1b46461b89079c09c7d692f4f4517))
* protect labels ([a0b24e1](https://github.com/christophehurpeau/reviewflow/commit/a0b24e1916da0a22cfc30998fa1bb03e7096c3da))



# [1.7.0](https://github.com/christophehurpeau/reviewflow/compare/v1.6.1...v1.7.0) (2019-04-03)


### Features

* support automerge after approve, checkrun/checksuite, synchromize ([704388d](https://github.com/christophehurpeau/reviewflow/commit/704388d45c7885f9d0f44003b52675f3956cb255))



## [1.6.1](https://github.com/christophehurpeau/reviewflow/compare/v1.6.0...v1.6.1) (2019-04-01)


### Bug Fixes

* diable checkrun and checksuite ([e1dd5c6](https://github.com/christophehurpeau/reviewflow/commit/e1dd5c6e8c1444f929db47a04caffd8f9d819132))



# [1.6.0](https://github.com/christophehurpeau/reviewflow/compare/v1.5.3...v1.6.0) (2019-04-01)


### Features

* also check if pr is mergeable after check suite ([774a945](https://github.com/christophehurpeau/reviewflow/commit/774a945ca32c22615631333cb48ad0b170b3a455))



## [1.5.3](https://github.com/christophehurpeau/reviewflow/compare/v1.5.2...v1.5.3) (2019-04-01)


### Bug Fixes

* githubLoginToGroup ([5d0be33](https://github.com/christophehurpeau/reviewflow/commit/5d0be33d75be85b8bbf87a7b191eede6a737c8dd))



## [1.5.2](https://github.com/christophehurpeau/reviewflow/compare/v1.5.1...v1.5.2) (2019-04-01)


### Bug Fixes

* missing awaits ([35d2baa](https://github.com/christophehurpeau/reviewflow/commit/35d2baaed5c891ae9403964fb34d870736b379eb))



## [1.5.1](https://github.com/christophehurpeau/reviewflow/compare/v1.5.0...v1.5.1) (2019-04-01)


### Bug Fixes

* requires node 10, not 11 ([21edd8f](https://github.com/christophehurpeau/reviewflow/commit/21edd8ff9b41b5ca5d6b50af0144619e48051697))



# [1.5.0](https://github.com/christophehurpeau/reviewflow/compare/v1.4.0...v1.5.0) (2019-04-01)


### Features

* add valerian and tilap ([e3ac7eb](https://github.com/christophehurpeau/reviewflow/commit/e3ac7ebd7136dc32546e7f8ac5dd58141e694954))



# [1.4.0](https://github.com/christophehurpeau/reviewflow/compare/v1.3.1...v1.4.0) (2019-04-01)


### Features

* add label automerge ([7b18681](https://github.com/christophehurpeau/reviewflow/commit/7b186813c0d01aac4e94c1fed727bab1a7055757))



## [1.3.1](https://github.com/christophehurpeau/reviewflow/compare/v1.3.0...v1.3.1) (2019-03-13)


### Bug Fixes

* always update status check ([c74f410](https://github.com/christophehurpeau/reviewflow/commit/c74f410825ee3238dc4165afaf8c60e816e19bbf))



# [1.3.0](https://github.com/christophehurpeau/reviewflow/compare/v1.2.0...v1.3.0) (2019-03-08)


### Bug Fixes

* remove rerequest on dismissed review, now that github added an option for that ([fc3e05c](https://github.com/christophehurpeau/reviewflow/commit/fc3e05c2782aa7acba45feb2bff1a58af35f8f86))


### Features

* add lock pr ([8fe8016](https://github.com/christophehurpeau/reviewflow/commit/8fe801658b880bb99eda2fc8e7e919004a8bd11c))
* option requiresReviewRequest ([6149bf3](https://github.com/christophehurpeau/reviewflow/commit/6149bf3aebae72cf7c4a08f6c1ed5a8a7a8ac090))
* use github status instead of check for lint-pr when check doesnt already exists ([a15ebaa](https://github.com/christophehurpeau/reviewflow/commit/a15ebaad04ff162a9e666e8a6ffe626187b3e26e))



# [1.2.0](https://github.com/christophehurpeau/reviewflow/compare/v1.1.3...v1.2.0) (2019-02-18)


### Bug Fixes

* update status check when approved added and no other labels exists ([6815c90](https://github.com/christophehurpeau/reviewflow/commit/6815c902a41aed670a9d14edfd4faf7d163f437f))


### Features

* on open pr, add code needs review label ([4df8e04](https://github.com/christophehurpeau/reviewflow/commit/4df8e047459661a0ef3e4f4f50c9e312e3dea44a))



## [1.1.3](https://github.com/christophehurpeau/reviewflow/compare/v1.1.2...v1.1.3) (2019-02-18)


### Bug Fixes

* dont try to assign bot user to pr ([d3edbe8](https://github.com/christophehurpeau/reviewflow/commit/d3edbe82eecc7b9502558140e05a64c603c432ac))



## [1.1.2](https://github.com/christophehurpeau/reviewflow/compare/v1.1.1...v1.1.2) (2019-02-01)


### Bug Fixes

* error title ([5e9dcaf](https://github.com/christophehurpeau/reviewflow/commit/5e9dcaf3577d8a35f372fa4ecd7975bb566b30c3))



## [1.1.1](https://github.com/christophehurpeau/reviewflow/compare/v1.1.0...v1.1.1) (2019-01-28)


### Bug Fixes

* prlint add skip bot and custom status ([2d74fe2](https://github.com/christophehurpeau/reviewflow/commit/2d74fe26928757ad0b50ba0a9df56e7b15ddc7db))



# [1.1.0](https://github.com/christophehurpeau/reviewflow/compare/v1.0.1...v1.1.0) (2019-01-27)


### Features

* lint pr with regexp rules ([aec6d86](https://github.com/christophehurpeau/reviewflow/commit/aec6d86764b0b446e8a3f93a599a1a4a60300c86))



## [1.0.1](https://github.com/christophehurpeau/reviewflow/compare/v1.0.0...v1.0.1) (2019-01-27)


### Bug Fixes

* add build script ([c747631](https://github.com/christophehurpeau/reviewflow/commit/c74763190b09241490b25589921ea336e45b7df4))



# [1.0.0](https://github.com/christophehurpeau/reviewflow/compare/d46fe984ad5880a4a009a812d453b0adb7831e49...v1.0.0) (2019-01-27)


### Bug Fixes

* add started_at ([dd43179](https://github.com/christophehurpeau/reviewflow/commit/dd431798b3b8b190ba88d96e2550f8e47abc0fbb))
* also trim dash ([851016d](https://github.com/christophehurpeau/reviewflow/commit/851016dab36abecce41ea9ad7bdff2aab30cf10b))
* cannot read property name of undefined ([b62c60e](https://github.com/christophehurpeau/reviewflow/commit/b62c60e6f238c95f8c85c34210d6dd5c858599fc))
* change ONK regexp ([62115f9](https://github.com/christophehurpeau/reviewflow/commit/62115f9368ae02272670a4d077e53a17d7eb3bee))
* comment review should remove the review requested label ([4fa0d50](https://github.com/christophehurpeau/reviewflow/commit/4fa0d50842cd956b460bee4003a9d0ea15d695e3))
* config labels requested color ([896f9c1](https://github.com/christophehurpeau/reviewflow/commit/896f9c199c124082ed41f3027f2d3385ffdab3b1))
* convert newLabels to array ([bf598c5](https://github.com/christophehurpeau/reviewflow/commit/bf598c5d7deea0ff4e0a89e83b95c12b91277235))
* createStatusCheckFromLabels ([9e7fee9](https://github.com/christophehurpeau/reviewflow/commit/9e7fee9031dfe63e6bd5aba5769380eebbc0648c))
* dismiss notif text ([5cc4461](https://github.com/christophehurpeau/reviewflow/commit/5cc4461a2c21a196e25d64cdec4c5e3856d6b170))
* dismiss review ([d46fe98](https://github.com/christophehurpeau/reviewflow/commit/d46fe984ad5880a4a009a812d453b0adb7831e49))
* dismissed event ([51fcf0e](https://github.com/christophehurpeau/reviewflow/commit/51fcf0e67c54ce26b27f8ec60bb9aadd74618814))
* handle synchronize, labelled and unlabelled events ([03bec47](https://github.com/christophehurpeau/reviewflow/commit/03bec47827297572d229594fc855b0a298d6e5f5))
* hasXReview method ([3748124](https://github.com/christophehurpeau/reviewflow/commit/374812448b84aca2a358e8894eeb853687e33909))
* ignore Bot review_requested notification ([819d88b](https://github.com/christophehurpeau/reviewflow/commit/819d88b57af9cd6b807aaef38ec5f5ce3531851e))
* ignore not handled labels ([1a1dfcd](https://github.com/christophehurpeau/reviewflow/commit/1a1dfcd71c85071b1bf61379ff09e3a066b650e7))
* label changesRequested ([a291899](https://github.com/christophehurpeau/reviewflow/commit/a291899f2e4cddb06287d6f19178829eba40a8a3))
* labels for status check when approve pr ([b06a942](https://github.com/christophehurpeau/reviewflow/commit/b06a9427eec6a3bb3471f306f18ab56c903e2e09))
* missing labels in createStatusCheckFromLabels ([7557903](https://github.com/christophehurpeau/reviewflow/commit/7557903d5f048253f5f13b6b245b31615285914f))
* only remove label requested when no other requested reviews ([298be2a](https://github.com/christophehurpeau/reviewflow/commit/298be2a524cc4f947e980d71d4e226cbdf3bf083))
* replaceAllLabels method ([835c4f7](https://github.com/christophehurpeau/reviewflow/commit/835c4f71802aae477b5fdd58b9446382a6c3e141))
* request review when review dismissed ([1312598](https://github.com/christophehurpeau/reviewflow/commit/1312598128184a384f9d0503ce186c8235fb3cfd))
* review status check when approved and still has needsReview ([50a0b5c](https://github.com/christophehurpeau/reviewflow/commit/50a0b5ca74ea3050cf9a4f75eae9ef4ed6eaeedd))
* review_requested remove label needsReview when REQUEST_CHANGES was done by the newly requested reviewer ([c080e9e](https://github.com/christophehurpeau/reviewflow/commit/c080e9ea1778bacc57fd376b853b0e9a255139bd))
* review_requested remove label needsReview when REQUEST_CHANGES was done by the newly requested reviewer ([46c0f3c](https://github.com/christophehurpeau/reviewflow/commit/46c0f3c05bc0d8cada82b8bb612d81712eb61ede))
* send notifs to slack ([df78bc3](https://github.com/christophehurpeau/reviewflow/commit/df78bc3e85589216f34a6eabd10954cb39670564))
* send notifs to slack ([6c96cec](https://github.com/christophehurpeau/reviewflow/commit/6c96cece590110f672b30facb44e53c75c065784))
* set has a delete method not remove ([6289059](https://github.com/christophehurpeau/reviewflow/commit/62890596609246ea12a426fa510bfc5b7cd2f441))
* update deprecated octokit api ([1872847](https://github.com/christophehurpeau/reviewflow/commit/187284739698829f353a0a7f5c7d95a595155b53))
* update deprecated octokit issues.edit to issues.update ([317fd17](https://github.com/christophehurpeau/reviewflow/commit/317fd17528a0748db7f5ef76c6826d292e8c2bad))
* use addAssignees instead of deprecated addAssigneesToIssue ([6932470](https://github.com/christophehurpeau/reviewflow/commit/69324707f820069837544e896078c0d802926e38))
* use replaceLabels to replace deprecated replaceAllLabels ([c563960](https://github.com/christophehurpeau/reviewflow/commit/c5639605825bb5ee8a72eca9fb918f56f61be344))
* **deps:** update dependency @slack/client to v4.8.0 ([#7](https://github.com/christophehurpeau/reviewflow/issues/7)) ([6353e3f](https://github.com/christophehurpeau/reviewflow/commit/6353e3f8668a5022884a8afdf3ba14a93741c0be))
* **deps:** update dependency probot to v7 ([#4](https://github.com/christophehurpeau/reviewflow/issues/4)) ([03f7405](https://github.com/christophehurpeau/reviewflow/commit/03f74052c844d4c36aacfbf8b4c620a899f62033))
* when review request removed and had changes requested, put back the right label ([3636d17](https://github.com/christophehurpeau/reviewflow/commit/3636d17188232e943eb9aaebffbe0cffdbe6eae9))


### Features

* add Coraline ([cc8a439](https://github.com/christophehurpeau/reviewflow/commit/cc8a4399d9773c922bf31681deb626c12aea070a))
* add Corentin ([82bd37e](https://github.com/christophehurpeau/reviewflow/commit/82bd37e4dadad2782842b2af0584a0897377edd2))
* add damienorny ([edb9f77](https://github.com/christophehurpeau/reviewflow/commit/edb9f77f0f3d4081050f45720734777241647ca0))
* add design tags ([7c4a24f](https://github.com/christophehurpeau/reviewflow/commit/7c4a24fa40a879769e9a2d1a3f32043df72b3043))
* add Mxime ([ad58b9f](https://github.com/christophehurpeau/reviewflow/commit/ad58b9ffd5bca02ab79ed3b0bd685e0b08a9945f))
* add romain to ornikar team and remove sofiane ([f79fcc4](https://github.com/christophehurpeau/reviewflow/commit/f79fcc49cdc44b9b57b6a3f239413b4774a3e321))
* add Sofiane ([656a5c7](https://github.com/christophehurpeau/reviewflow/commit/656a5c759f7c80278b3c1373458526435c1fa4c6))
* clean title ([d3a7bf2](https://github.com/christophehurpeau/reviewflow/commit/d3a7bf2bbfe41144032e5db887f7192ad9ec491b))
* clean title support revert ([25357c2](https://github.com/christophehurpeau/reviewflow/commit/25357c25b906caee03769adf22b0b744e169e186))
* config autoAssignToCreator ([78c278a](https://github.com/christophehurpeau/reviewflow/commit/78c278a6defff3bd77dcffac93ae76a57e6b45c4))
* enable labels for code and design ([a94e8d4](https://github.com/christophehurpeau/reviewflow/commit/a94e8d457d08062c3d1443c92c85a0bd07805580))
* handle edited pr ([c5340c5](https://github.com/christophehurpeau/reviewflow/commit/c5340c5faba99af06b1d95b225bb9f5a1099759d))
* reenable sender check in dissmissed review ([2a88c1f](https://github.com/christophehurpeau/reviewflow/commit/2a88c1f8cf352fa74135429daa9a8a0576737877))
* status checks review ([4658ee1](https://github.com/christophehurpeau/reviewflow/commit/4658ee1e45a4875b249f002d4767cfc5e2e877d8))
* trim title ([5b89981](https://github.com/christophehurpeau/reviewflow/commit/5b89981cefe824d316f0148637f0622a7b855cb0))
* use kitt colors ([6abedd4](https://github.com/christophehurpeau/reviewflow/commit/6abedd4d948796ea234a5c0e96472ae145ad8b60))
* wording ([9f60523](https://github.com/christophehurpeau/reviewflow/commit/9f60523f14a0757cb531f091751d7ab83a0c03dc))
