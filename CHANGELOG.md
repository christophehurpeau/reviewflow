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



