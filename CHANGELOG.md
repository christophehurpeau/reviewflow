## [1.20.1](https://github.com/christophehurpeau/reviewflow/compare/v1.20.0...v1.20.1) (2019-06-26)


### Bug Fixes

* githubLoginToTeams ([7ad44f0](https://github.com/christophehurpeau/reviewflow/commit/7ad44f0))



# [1.20.0](https://github.com/christophehurpeau/reviewflow/compare/v1.19.7...v1.20.0) (2019-06-26)


### Bug Fixes

* ignore edits from bots ([dc944ab](https://github.com/christophehurpeau/reviewflow/commit/dc944ab))
* use autoMergeWithSkipCi when merge is auto approved to avoid unwanted deployments ([2f36630](https://github.com/christophehurpeau/reviewflow/commit/2f36630))


### Features

* orgs and teams ([0c8974f](https://github.com/christophehurpeau/reviewflow/commit/0c8974f))
* simplify updatePrBody ([649fd81](https://github.com/christophehurpeau/reviewflow/commit/649fd81))



## [1.19.7](https://github.com/christophehurpeau/reviewflow/compare/v1.19.6...v1.19.7) (2019-06-26)


### Bug Fixes

* removePrFromAutomergeQueue ([35b818a](https://github.com/christophehurpeau/reviewflow/commit/35b818a))
* support endings, for renovate body for example ([9c3c0fb](https://github.com/christophehurpeau/reviewflow/commit/9c3c0fb))



## [1.19.6](https://github.com/christophehurpeau/reviewflow/compare/v1.19.5...v1.19.6) (2019-06-11)


### Bug Fixes

* ensure pr number is always compared as string ([a10bfbc](https://github.com/christophehurpeau/reviewflow/commit/a10bfbc))



## [1.19.5](https://github.com/christophehurpeau/reviewflow/compare/v1.19.4...v1.19.5) (2019-06-11)


### Bug Fixes

* remove queued pr when pr is closed ([b86e733](https://github.com/christophehurpeau/reviewflow/commit/b86e733))



## [1.19.4](https://github.com/christophehurpeau/reviewflow/compare/v1.19.3...v1.19.4) (2019-06-10)


### Bug Fixes

* labels change only take events from non bot or renovate bot ([dc22e05](https://github.com/christophehurpeau/reviewflow/commit/dc22e05))



## [1.19.3](https://github.com/christophehurpeau/reviewflow/compare/v1.19.2...v1.19.3) (2019-05-28)


### Bug Fixes

* still try to automerge when pr is closed ([70af724](https://github.com/christophehurpeau/reviewflow/commit/70af724))



## [1.19.2](https://github.com/christophehurpeau/reviewflow/compare/v1.19.1...v1.19.2) (2019-05-27)


### Bug Fixes

* label change featurebranch vs automerge ([bda6aed](https://github.com/christophehurpeau/reviewflow/commit/bda6aed))



## [1.19.1](https://github.com/christophehurpeau/reviewflow/compare/v1.19.0...v1.19.1) (2019-05-25)


### Bug Fixes

* missing reviewflow status on renovate pr ([e71d725](https://github.com/christophehurpeau/reviewflow/commit/e71d725))
* prevent multiple approve on renovate prs ([40ef01d](https://github.com/christophehurpeau/reviewflow/commit/40ef01d))



# [1.19.0](https://github.com/christophehurpeau/reviewflow/compare/v1.18.2...v1.19.0) (2019-05-25)


### Bug Fixes

* bring back jira-issue link ([f9dc926](https://github.com/christophehurpeau/reviewflow/commit/f9dc926))


### Features

* add option autoMerge ([e418623](https://github.com/christophehurpeau/reviewflow/commit/e418623))
* add option autoMerge ([534436a](https://github.com/christophehurpeau/reviewflow/commit/534436a))
* add option autoMergeWithSkipCi ([bb76ec5](https://github.com/christophehurpeau/reviewflow/commit/bb76ec5))
* feature-branch label sync with options ([f0558d4](https://github.com/christophehurpeau/reviewflow/commit/f0558d4))
* sync feature-branch label ([278aa6f](https://github.com/christophehurpeau/reviewflow/commit/278aa6f))
* sync feature-branch label with tag ([0f47044](https://github.com/christophehurpeau/reviewflow/commit/0f47044))



## [1.18.2](https://github.com/christophehurpeau/reviewflow/compare/v1.18.1...v1.18.2) (2019-05-25)


### Bug Fixes

* renovate adds labels after opening pr ([5bc57e0](https://github.com/christophehurpeau/reviewflow/commit/5bc57e0))



## [1.18.1](https://github.com/christophehurpeau/reviewflow/compare/v1.18.0...v1.18.1) (2019-05-22)


### Bug Fixes

* only need code/approved on renovate pr open to trigger automerge ([75490f1](https://github.com/christophehurpeau/reviewflow/commit/75490f1))



# [1.18.0](https://github.com/christophehurpeau/reviewflow/compare/v1.17.1...v1.18.0) (2019-05-22)


### Bug Fixes

* autoApproveAndAutoMerge after pr opened when from renovate ([e6b7e08](https://github.com/christophehurpeau/reviewflow/commit/e6b7e08))
* **deps:** update dependency probot to v9.2.11 ([#56](https://github.com/christophehurpeau/reviewflow/issues/56)) ([4ca9378](https://github.com/christophehurpeau/reviewflow/commit/4ca9378))


### Features

* add pixy in ornikar config ([d6be52e](https://github.com/christophehurpeau/reviewflow/commit/d6be52e))
* auto approve when from renovate ([a70a549](https://github.com/christophehurpeau/reviewflow/commit/a70a549))
* ornikar remove jira-issue status ([35f110f](https://github.com/christophehurpeau/reviewflow/commit/35f110f))



## [1.17.1](https://github.com/christophehurpeau/reviewflow/compare/v1.17.0...v1.17.1) (2019-05-21)



# [1.17.0](https://github.com/christophehurpeau/reviewflow/compare/v1.16.0...v1.17.0) (2019-05-20)


### Features

* pr from bot jira-issue ([f2441fd](https://github.com/christophehurpeau/reviewflow/commit/f2441fd))



# [1.16.0](https://github.com/christophehurpeau/reviewflow/compare/v1.15.2...v1.16.0) (2019-05-20)


### Features

* optional review when pr came from renovate ([0561ec3](https://github.com/christophehurpeau/reviewflow/commit/0561ec3))



## [1.15.2](https://github.com/christophehurpeau/reviewflow/compare/v1.15.1...v1.15.2) (2019-05-07)


### Bug Fixes

* call autoMergeIfPossible on synchronize ([36edd20](https://github.com/christophehurpeau/reviewflow/commit/36edd20))
* only edit changed fields in pr ([02b4385](https://github.com/christophehurpeau/reviewflow/commit/02b4385))



## [1.15.1](https://github.com/christophehurpeau/reviewflow/compare/v1.15.0...v1.15.1) (2019-05-03)


### Bug Fixes

* auto merge when need to update branch ([f7809df](https://github.com/christophehurpeau/reviewflow/commit/f7809df))



# [1.15.0](https://github.com/christophehurpeau/reviewflow/compare/v1.14.0...v1.15.0) (2019-05-03)


### Bug Fixes

* use combined status ([9b2c876](https://github.com/christophehurpeau/reviewflow/commit/9b2c876))


### Features

* add tilap in teamconfig ([423935f](https://github.com/christophehurpeau/reviewflow/commit/423935f))
* ignore repo reviewflow-test when name is not reviewflow-test ([a6b58d4](https://github.com/christophehurpeau/reviewflow/commit/a6b58d4))
* remove label merge/delete-branch ([0eaaf0e](https://github.com/christophehurpeau/reviewflow/commit/0eaaf0e))



# [1.14.0](https://github.com/christophehurpeau/reviewflow/compare/v1.13.0...v1.14.0) (2019-05-02)


### Bug Fixes

* **deps:** update dependency @slack/web-api to v5.0.1 ([#48](https://github.com/christophehurpeau/reviewflow/issues/48)) ([1342cb7](https://github.com/christophehurpeau/reviewflow/commit/1342cb7))


### Features

* add 2 members in ornikar team ([411ae2a](https://github.com/christophehurpeau/reviewflow/commit/411ae2a))



# [1.13.0](https://github.com/christophehurpeau/reviewflow/compare/v1.12.0...v1.13.0) (2019-04-26)


### Features

* support simplier template ([4e8c276](https://github.com/christophehurpeau/reviewflow/commit/4e8c276))



# [1.12.0](https://github.com/christophehurpeau/reviewflow/compare/v1.11.0...v1.12.0) (2019-04-24)


### Bug Fixes

* test ([7437b66](https://github.com/christophehurpeau/reviewflow/commit/7437b66))


### Features

* support space and lowercase in ONK ([bbdbf59](https://github.com/christophehurpeau/reviewflow/commit/bbdbf59))



# [1.11.0](https://github.com/christophehurpeau/reviewflow/compare/v1.10.1...v1.11.0) (2019-04-24)


### Features

* add more log when automerged removed from status/check failed ([2020480](https://github.com/christophehurpeau/reviewflow/commit/2020480))



## [1.10.1](https://github.com/christophehurpeau/reviewflow/compare/v1.10.0...v1.10.1) (2019-04-23)


### Bug Fixes

* automerge blocked status ([1d977ce](https://github.com/christophehurpeau/reviewflow/commit/1d977ce))



# [1.10.0](https://github.com/christophehurpeau/reviewflow/compare/v1.9.20...v1.10.0) (2019-04-22)


### Features

* pr parse body and auto delete branch and feature branch ([7b78e3c](https://github.com/christophehurpeau/reviewflow/commit/7b78e3c))



## [1.9.20](https://github.com/christophehurpeau/reviewflow/compare/v1.9.19...v1.9.20) (2019-04-14)


### Bug Fixes

* allow to merge when unstable, when jobs are in hold in circleci ([7bc1948](https://github.com/christophehurpeau/reviewflow/commit/7bc1948))



## [1.9.19](https://github.com/christophehurpeau/reviewflow/compare/v1.9.18...v1.9.19) (2019-04-14)


### Bug Fixes

* rescheduling when unstable ([c0dd749](https://github.com/christophehurpeau/reviewflow/commit/c0dd749))



## [1.9.18](https://github.com/christophehurpeau/reviewflow/compare/v1.9.17...v1.9.18) (2019-04-14)


### Bug Fixes

* reschedule when fail ([4cd4d04](https://github.com/christophehurpeau/reviewflow/commit/4cd4d04))



## [1.9.17](https://github.com/christophehurpeau/reviewflow/compare/v1.9.16...v1.9.17) (2019-04-14)


### Bug Fixes

* prevent merge when mergeable_state is not clean (like unstable) ([f0342c1](https://github.com/christophehurpeau/reviewflow/commit/f0342c1))



## [1.9.16](https://github.com/christophehurpeau/reviewflow/compare/v1.9.15...v1.9.16) (2019-04-14)


### Bug Fixes

* support status ([418fa10](https://github.com/christophehurpeau/reviewflow/commit/418fa10))



## [1.9.15](https://github.com/christophehurpeau/reviewflow/compare/v1.9.14...v1.9.15) (2019-04-14)


### Bug Fixes

* mergeable_state === behind doesnt mean not mergeable - except it is ([a822bd8](https://github.com/christophehurpeau/reviewflow/commit/a822bd8))



## [1.9.14](https://github.com/christophehurpeau/reviewflow/compare/v1.9.13...v1.9.14) (2019-04-14)


### Bug Fixes

* release lock when pr is already merged ([68b91df](https://github.com/christophehurpeau/reviewflow/commit/68b91df))



## [1.9.13](https://github.com/christophehurpeau/reviewflow/compare/v1.9.12...v1.9.13) (2019-04-14)


### Bug Fixes

* pr result and pr id ([672be5b](https://github.com/christophehurpeau/reviewflow/commit/672be5b))
* pr result and pr id ([e90a150](https://github.com/christophehurpeau/reviewflow/commit/e90a150))



## [1.9.12](https://github.com/christophehurpeau/reviewflow/compare/v1.9.11...v1.9.12) (2019-04-14)


### Bug Fixes

* mergeable state ([1907bd9](https://github.com/christophehurpeau/reviewflow/commit/1907bd9))



## [1.9.11](https://github.com/christophehurpeau/reviewflow/compare/v1.9.10...v1.9.11) (2019-04-14)


### Bug Fixes

* lock merge before doing anything in autoMergeIfPossible ([6347758](https://github.com/christophehurpeau/reviewflow/commit/6347758))



## [1.9.10](https://github.com/christophehurpeau/reviewflow/compare/v1.9.9...v1.9.10) (2019-04-14)


### Bug Fixes

* return false when reschueduling ([cc965bb](https://github.com/christophehurpeau/reviewflow/commit/cc965bb))



## [1.9.9](https://github.com/christophehurpeau/reviewflow/compare/v1.9.8...v1.9.9) (2019-04-14)


### Bug Fixes

* use status and checks to determine if pr should be unlocked ([bdf7ce6](https://github.com/christophehurpeau/reviewflow/commit/bdf7ce6))



## [1.9.8](https://github.com/christophehurpeau/reviewflow/compare/v1.9.7...v1.9.8) (2019-04-14)


### Bug Fixes

* pr number when edit renovate pr body ([96ecbd1](https://github.com/christophehurpeau/reviewflow/commit/96ecbd1))



## [1.9.7](https://github.com/christophehurpeau/reviewflow/compare/v1.9.6...v1.9.7) (2019-04-14)


### Bug Fixes

* error when trying to lock same number ([0198901](https://github.com/christophehurpeau/reviewflow/commit/0198901))



## [1.9.6](https://github.com/christophehurpeau/reviewflow/compare/v1.9.5...v1.9.6) (2019-04-14)


### Bug Fixes

* locked pr forever ([429b129](https://github.com/christophehurpeau/reviewflow/commit/429b129))



## [1.9.5](https://github.com/christophehurpeau/reviewflow/compare/v1.9.4...v1.9.5) (2019-04-14)


### Bug Fixes

* use pr.number ([1774dde](https://github.com/christophehurpeau/reviewflow/commit/1774dde))



## [1.9.4](https://github.com/christophehurpeau/reviewflow/compare/v1.9.3...v1.9.4) (2019-04-14)


### Bug Fixes

* unlock after merge ([87af768](https://github.com/christophehurpeau/reviewflow/commit/87af768))



## [1.9.3](https://github.com/christophehurpeau/reviewflow/compare/v1.9.2...v1.9.3) (2019-04-14)



## [1.9.2](https://github.com/christophehurpeau/reviewflow/compare/v1.9.1...v1.9.2) (2019-04-14)


### Bug Fixes

* release merge when merge fails ([21cbb07](https://github.com/christophehurpeau/reviewflow/commit/21cbb07))



## [1.9.1](https://github.com/christophehurpeau/reviewflow/compare/v1.9.0...v1.9.1) (2019-04-14)


### Bug Fixes

* use checkbox to rebase renovate pr ([b0d2516](https://github.com/christophehurpeau/reviewflow/commit/b0d2516))



# [1.9.0](https://github.com/christophehurpeau/reviewflow/compare/v1.8.1...v1.9.0) (2019-04-14)


### Bug Fixes

* **deps:** update dependency probot to v9.2.0 ([#44](https://github.com/christophehurpeau/reviewflow/issues/44)) ([64bf7f6](https://github.com/christophehurpeau/reviewflow/commit/64bf7f6))


### Features

* smaller error messages ([04c60c9](https://github.com/christophehurpeau/reviewflow/commit/04c60c9))
* support automerge lock and queue ([ed8eb2b](https://github.com/christophehurpeau/reviewflow/commit/ed8eb2b))



## [1.8.1](https://github.com/christophehurpeau/reviewflow/compare/v1.8.0...v1.8.1) (2019-04-04)


### Bug Fixes

* date ([fab13dd](https://github.com/christophehurpeau/reviewflow/commit/fab13dd))



# [1.8.0](https://github.com/christophehurpeau/reviewflow/compare/v1.7.0...v1.8.0) (2019-04-03)


### Features

* improve reviewflow error status ([7ff2078](https://github.com/christophehurpeau/reviewflow/commit/7ff2078))
* protect labels ([a0b24e1](https://github.com/christophehurpeau/reviewflow/commit/a0b24e1))



# [1.7.0](https://github.com/christophehurpeau/reviewflow/compare/v1.6.1...v1.7.0) (2019-04-03)


### Features

* support automerge after approve, checkrun/checksuite, synchromize ([704388d](https://github.com/christophehurpeau/reviewflow/commit/704388d))



## [1.6.1](https://github.com/christophehurpeau/reviewflow/compare/v1.6.0...v1.6.1) (2019-04-01)


### Bug Fixes

* diable checkrun and checksuite ([e1dd5c6](https://github.com/christophehurpeau/reviewflow/commit/e1dd5c6))



# [1.6.0](https://github.com/christophehurpeau/reviewflow/compare/v1.5.3...v1.6.0) (2019-04-01)


### Features

* also check if pr is mergeable after check suite ([774a945](https://github.com/christophehurpeau/reviewflow/commit/774a945))



## [1.5.3](https://github.com/christophehurpeau/reviewflow/compare/v1.5.2...v1.5.3) (2019-04-01)


### Bug Fixes

* githubLoginToGroup ([5d0be33](https://github.com/christophehurpeau/reviewflow/commit/5d0be33))



## [1.5.2](https://github.com/christophehurpeau/reviewflow/compare/v1.5.1...v1.5.2) (2019-04-01)


### Bug Fixes

* missing awaits ([35d2baa](https://github.com/christophehurpeau/reviewflow/commit/35d2baa))



## [1.5.1](https://github.com/christophehurpeau/reviewflow/compare/v1.5.0...v1.5.1) (2019-04-01)


### Bug Fixes

* requires node 10, not 11 ([21edd8f](https://github.com/christophehurpeau/reviewflow/commit/21edd8f))



# [1.5.0](https://github.com/christophehurpeau/reviewflow/compare/v1.4.0...v1.5.0) (2019-04-01)


### Features

* add valerian and tilap ([e3ac7eb](https://github.com/christophehurpeau/reviewflow/commit/e3ac7eb))



# [1.4.0](https://github.com/christophehurpeau/reviewflow/compare/v1.3.1...v1.4.0) (2019-04-01)


### Features

* add label automerge ([7b18681](https://github.com/christophehurpeau/reviewflow/commit/7b18681))



## [1.3.1](https://github.com/christophehurpeau/reviewflow/compare/v1.3.0...v1.3.1) (2019-03-13)


### Bug Fixes

* always update status check ([c74f410](https://github.com/christophehurpeau/reviewflow/commit/c74f410))



# [1.3.0](https://github.com/christophehurpeau/reviewflow/compare/v1.2.0...v1.3.0) (2019-03-08)


### Bug Fixes

* remove rerequest on dismissed review, now that github added an option for that ([fc3e05c](https://github.com/christophehurpeau/reviewflow/commit/fc3e05c))


### Features

* add lock pr ([8fe8016](https://github.com/christophehurpeau/reviewflow/commit/8fe8016))
* option requiresReviewRequest ([6149bf3](https://github.com/christophehurpeau/reviewflow/commit/6149bf3))
* use github status instead of check for lint-pr when check doesnt already exists ([a15ebaa](https://github.com/christophehurpeau/reviewflow/commit/a15ebaa))



# [1.2.0](https://github.com/christophehurpeau/reviewflow/compare/v1.1.3...v1.2.0) (2019-02-18)


### Bug Fixes

* update status check when approved added and no other labels exists ([6815c90](https://github.com/christophehurpeau/reviewflow/commit/6815c90))


### Features

* on open pr, add code needs review label ([4df8e04](https://github.com/christophehurpeau/reviewflow/commit/4df8e04))



## [1.1.3](https://github.com/christophehurpeau/reviewflow/compare/v1.1.2...v1.1.3) (2019-02-18)


### Bug Fixes

* dont try to assign bot user to pr ([d3edbe8](https://github.com/christophehurpeau/reviewflow/commit/d3edbe8))



## [1.1.2](https://github.com/christophehurpeau/reviewflow/compare/v1.1.1...v1.1.2) (2019-02-01)


### Bug Fixes

* error title ([5e9dcaf](https://github.com/christophehurpeau/reviewflow/commit/5e9dcaf))



## [1.1.1](https://github.com/christophehurpeau/reviewflow/compare/v1.1.0...v1.1.1) (2019-01-28)


### Bug Fixes

* prlint add skip bot and custom status ([2d74fe2](https://github.com/christophehurpeau/reviewflow/commit/2d74fe2))



# [1.1.0](https://github.com/christophehurpeau/reviewflow/compare/v1.0.1...v1.1.0) (2019-01-27)


### Features

* lint pr with regexp rules ([aec6d86](https://github.com/christophehurpeau/reviewflow/commit/aec6d86))



## [1.0.1](https://github.com/christophehurpeau/reviewflow/compare/v1.0.0...v1.0.1) (2019-01-27)


### Bug Fixes

* add build script ([c747631](https://github.com/christophehurpeau/reviewflow/commit/c747631))



# [1.0.0](https://github.com/christophehurpeau/reviewflow/compare/d46fe98...v1.0.0) (2019-01-27)


### Bug Fixes

* add started_at ([dd43179](https://github.com/christophehurpeau/reviewflow/commit/dd43179))
* also trim dash ([851016d](https://github.com/christophehurpeau/reviewflow/commit/851016d))
* cannot read property name of undefined ([b62c60e](https://github.com/christophehurpeau/reviewflow/commit/b62c60e))
* change ONK regexp ([62115f9](https://github.com/christophehurpeau/reviewflow/commit/62115f9))
* comment review should remove the review requested label ([4fa0d50](https://github.com/christophehurpeau/reviewflow/commit/4fa0d50))
* config labels requested color ([896f9c1](https://github.com/christophehurpeau/reviewflow/commit/896f9c1))
* convert newLabels to array ([bf598c5](https://github.com/christophehurpeau/reviewflow/commit/bf598c5))
* createStatusCheckFromLabels ([9e7fee9](https://github.com/christophehurpeau/reviewflow/commit/9e7fee9))
* dismiss notif text ([5cc4461](https://github.com/christophehurpeau/reviewflow/commit/5cc4461))
* dismiss review ([d46fe98](https://github.com/christophehurpeau/reviewflow/commit/d46fe98))
* dismissed event ([51fcf0e](https://github.com/christophehurpeau/reviewflow/commit/51fcf0e))
* handle synchronize, labelled and unlabelled events ([03bec47](https://github.com/christophehurpeau/reviewflow/commit/03bec47))
* hasXReview method ([3748124](https://github.com/christophehurpeau/reviewflow/commit/3748124))
* ignore Bot review_requested notification ([819d88b](https://github.com/christophehurpeau/reviewflow/commit/819d88b))
* ignore not handled labels ([1a1dfcd](https://github.com/christophehurpeau/reviewflow/commit/1a1dfcd))
* label changesRequested ([a291899](https://github.com/christophehurpeau/reviewflow/commit/a291899))
* labels for status check when approve pr ([b06a942](https://github.com/christophehurpeau/reviewflow/commit/b06a942))
* missing labels in createStatusCheckFromLabels ([7557903](https://github.com/christophehurpeau/reviewflow/commit/7557903))
* only remove label requested when no other requested reviews ([298be2a](https://github.com/christophehurpeau/reviewflow/commit/298be2a))
* replaceAllLabels method ([835c4f7](https://github.com/christophehurpeau/reviewflow/commit/835c4f7))
* request review when review dismissed ([1312598](https://github.com/christophehurpeau/reviewflow/commit/1312598))
* review status check when approved and still has needsReview ([50a0b5c](https://github.com/christophehurpeau/reviewflow/commit/50a0b5c))
* review_requested remove label needsReview when REQUEST_CHANGES was done by the newly requested reviewer ([c080e9e](https://github.com/christophehurpeau/reviewflow/commit/c080e9e))
* review_requested remove label needsReview when REQUEST_CHANGES was done by the newly requested reviewer ([46c0f3c](https://github.com/christophehurpeau/reviewflow/commit/46c0f3c))
* send notifs to slack ([df78bc3](https://github.com/christophehurpeau/reviewflow/commit/df78bc3))
* send notifs to slack ([6c96cec](https://github.com/christophehurpeau/reviewflow/commit/6c96cec))
* set has a delete method not remove ([6289059](https://github.com/christophehurpeau/reviewflow/commit/6289059))
* update deprecated octokit api ([1872847](https://github.com/christophehurpeau/reviewflow/commit/1872847))
* update deprecated octokit issues.edit to issues.update ([317fd17](https://github.com/christophehurpeau/reviewflow/commit/317fd17))
* use addAssignees instead of deprecated addAssigneesToIssue ([6932470](https://github.com/christophehurpeau/reviewflow/commit/6932470))
* use replaceLabels to replace deprecated replaceAllLabels ([c563960](https://github.com/christophehurpeau/reviewflow/commit/c563960))
* **deps:** update dependency @slack/client to v4.8.0 ([#7](https://github.com/christophehurpeau/reviewflow/issues/7)) ([6353e3f](https://github.com/christophehurpeau/reviewflow/commit/6353e3f))
* **deps:** update dependency probot to v7 ([#4](https://github.com/christophehurpeau/reviewflow/issues/4)) ([03f7405](https://github.com/christophehurpeau/reviewflow/commit/03f7405))
* when review request removed and had changes requested, put back the right label ([3636d17](https://github.com/christophehurpeau/reviewflow/commit/3636d17))


### Features

* add Coraline ([cc8a439](https://github.com/christophehurpeau/reviewflow/commit/cc8a439))
* add Corentin ([82bd37e](https://github.com/christophehurpeau/reviewflow/commit/82bd37e))
* add damienorny ([edb9f77](https://github.com/christophehurpeau/reviewflow/commit/edb9f77))
* add design tags ([7c4a24f](https://github.com/christophehurpeau/reviewflow/commit/7c4a24f))
* add Mxime ([ad58b9f](https://github.com/christophehurpeau/reviewflow/commit/ad58b9f))
* add romain to ornikar team and remove sofiane ([f79fcc4](https://github.com/christophehurpeau/reviewflow/commit/f79fcc4))
* add Sofiane ([656a5c7](https://github.com/christophehurpeau/reviewflow/commit/656a5c7))
* clean title ([d3a7bf2](https://github.com/christophehurpeau/reviewflow/commit/d3a7bf2))
* clean title support revert ([25357c2](https://github.com/christophehurpeau/reviewflow/commit/25357c2))
* config autoAssignToCreator ([78c278a](https://github.com/christophehurpeau/reviewflow/commit/78c278a))
* enable labels for code and design ([a94e8d4](https://github.com/christophehurpeau/reviewflow/commit/a94e8d4))
* handle edited pr ([c5340c5](https://github.com/christophehurpeau/reviewflow/commit/c5340c5))
* reenable sender check in dissmissed review ([2a88c1f](https://github.com/christophehurpeau/reviewflow/commit/2a88c1f))
* status checks review ([4658ee1](https://github.com/christophehurpeau/reviewflow/commit/4658ee1))
* trim title ([5b89981](https://github.com/christophehurpeau/reviewflow/commit/5b89981))
* use kitt colors ([6abedd4](https://github.com/christophehurpeau/reviewflow/commit/6abedd4))
* wording ([9f60523](https://github.com/christophehurpeau/reviewflow/commit/9f60523))



