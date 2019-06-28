'use strict';

require('dotenv/config');
const probot = require('probot');
const lock = require('lock');
const webApi = require('@slack/web-api');

const config = {
  slackToken: process.env.ORNIKAR_SLACK_TOKEN,
  autoAssignToCreator: true,
  trimTitle: true,
  requiresReviewRequest: true,
  prDefaultOptions: {
    featureBranch: false,
    autoMergeWithSkipCi: false,
    autoMerge: false,
    deleteAfterMerge: true
  },
  parsePR: {
    title: [{
      regExp: // eslint-disable-next-line unicorn/no-unsafe-regex
      /^(revert: )?(build|chore|ci|docs|feat|fix|perf|refactor|style|test)(\(([a-z\-/]*)\))?:\s/,
      error: {
        title: 'Title does not match commitlint conventional',
        summary: 'https://github.com/marionebl/commitlint/tree/master/%40commitlint/config-conventional'
      }
    }, {
      bot: false,
      regExp: /\s(ONK-(\d+)|\[no issue])$/,
      error: {
        title: 'Title does not have JIRA issue',
        summary: 'The PR title should end with ONK-0000, or [no issue]'
      },
      status: 'jira-issue',
      statusInfoFromMatch: match => {
        const issue = match[1];

        if (issue === '[no issue]') {
          return {
            title: 'No issue',
            summary: ''
          };
        }

        return {
          inBody: true,
          url: `https://ornikar.atlassian.net/browse/${issue}`,
          title: `JIRA issue: ${issue}`,
          summary: `[${issue}](https://ornikar.atlassian.net/browse/${issue})`
        };
      }
    }]
  },
  groups: {
    dev: {
      /* back */
      abarreir: `alexandre${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      arthurflachs: `arthur${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      rigma: `romain${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      damienorny: `damien.orny${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      'Thierry-girod': `thierry${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      darame07: `kevin${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      Pixy: `pierre-alexis${process.env.ORNIKAR_EMAIL_DOMAIN}`,

      /* front */
      christophehurpeau: `christophe${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      HugoGarrido: `hugo${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      LentnerStefan: `stefan${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      CorentinAndre: `corentin${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      Mxime: `maxime${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      tilap: `julien.lavinh${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      '63m29': `valerian${process.env.ORNIKAR_EMAIL_DOMAIN}`
    },
    design: {
      jperriere: `julien${process.env.ORNIKAR_EMAIL_DOMAIN}`,
      CoralineColasse: `coraline${process.env.ORNIKAR_EMAIL_DOMAIN}`
    }
  },
  teams: {
    backends: {
      logins: ['abarreir', 'arthurflachs', 'rigma', 'damienorny', 'Thierry-girod', 'darame07', 'Pixy'],
      labels: ['teams/backend']
    },
    frontends: {
      logins: ['christophehurpeau', 'HugoGarrido', 'LentnerStefan', 'CorentinAndre', 'Mxime', 'tilap', '63m29'],
      labels: ['teams/frontend']
    }
  },
  waitForGroups: {
    dev: [],
    design: ['dev']
  },
  labels: {
    list: {
      // /* ci */
      // 'ci/in-progress': { name: ':green_heart: ci/in-progress', color: '#0052cc' },
      // 'ci/fail': { name: ':green_heart: ci/fail', color: '#e11d21' },
      // 'ci/passed': { name: ':green_heart: ci/passed', color: '#86f9b4' },

      /* code */
      'code/needs-review': {
        name: ':ok_hand: code/needs-review',
        color: '#FFC44C'
      },
      'code/review-requested': {
        name: ':ok_hand: code/review-requested',
        color: '#DAE1E6'
      },
      'code/changes-requested': {
        name: ':ok_hand: code/changes-requested',
        color: '#e11d21'
      },
      'code/approved': {
        name: ':ok_hand: code/approved',
        color: '#64DD17'
      },

      /* design */
      'design/needs-review': {
        name: ':art: design/needs-review',
        color: '#FFC44C'
      },
      'design/review-requested': {
        name: ':art: design/review-requested',
        color: '#DAE1E6'
      },
      'design/changes-requested': {
        name: ':art: design/changes-requested',
        color: '#e11d21'
      },
      'design/approved': {
        name: ':art: design/approved',
        color: '#64DD17'
      },

      /* teams */
      'teams/backend': {
        name: 'backend',
        color: '#6ad8cb'
      },
      'teams/frontend': {
        name: 'frontend',
        color: '#8a5abc'
      },

      /* auto merge */
      'merge/automerge': {
        name: ':soon: automerge',
        color: '#64DD17'
      },

      /* feature-branch */
      'feature-branch': {
        name: 'feature-branch',
        color: '#7FCEFF'
      }
    },
    review: {
      ci: {
        inProgress: 'ci/in-progress',
        succeeded: 'ci/success',
        failed: 'ci/fail'
      },
      dev: {
        needsReview: 'code/needs-review',
        requested: 'code/review-requested',
        changesRequested: 'code/changes-requested',
        approved: 'code/approved'
      },
      design: {
        needsReview: 'design/needs-review',
        requested: 'design/review-requested',
        changesRequested: 'design/changes-requested',
        approved: 'design/approved'
      }
    }
  }
};

const config$1 = {
  autoAssignToCreator: true,
  trimTitle: true,
  requiresReviewRequest: false,
  prDefaultOptions: {
    featureBranch: false,
    autoMergeWithSkipCi: false,
    autoMerge: false,
    deleteAfterMerge: true
  },
  parsePR: {
    title: [{
      regExp: // eslint-disable-next-line unicorn/no-unsafe-regex
      /^(revert: )?(build|chore|ci|docs|feat|fix|perf|refactor|style|test)(\(([a-z\-/]*)\))?:\s/,
      error: {
        title: 'Title does not match commitlint conventional',
        summary: 'https://github.com/marionebl/commitlint/tree/master/%40commitlint/config-conventional'
      }
    }]
  },
  groups: {
    dev: {
      christophehurpeau: 'christophe@hurpeau.com',
      'chris-reviewflow': 'christophe.hurpeau+reviewflow@gmail.com',
      tilap: 'jlavinh@gmail.com'
    }
  },
  waitForGroups: {
    dev: []
  },
  teams: {},
  labels: {
    list: {
      // /* ci */
      // 'ci/in-progress': { name: ':green_heart: ci/in-progress', color: '#0052cc' },
      // 'ci/fail': { name: ':green_heart: ci/fail', color: '#e11d21' },
      // 'ci/passed': { name: ':green_heart: ci/passed', color: '#86f9b4' },

      /* code */
      'code/needs-review': {
        name: ':ok_hand: code/needs-review',
        color: '#FFD57F'
      },
      'code/review-requested': {
        name: ':ok_hand: code/review-requested',
        color: '#B2E1FF'
      },
      'code/changes-requested': {
        name: ':ok_hand: code/changes-requested',
        color: '#e11d21'
      },
      'code/approved': {
        name: ':ok_hand: code/approved',
        color: '#64DD17'
      },

      /* auto merge */
      'merge/automerge': {
        name: ':soon: automerge',
        color: '#64DD17'
      },

      /* feature-branch */
      'feature-branch': {
        name: 'feature-branch',
        color: '#7FCEFF'
      }
    },
    review: {
      ci: {
        inProgress: 'ci/in-progress',
        succeeded: 'ci/success',
        failed: 'ci/fail'
      },
      dev: {
        needsReview: 'code/needs-review',
        requested: 'code/review-requested',
        changesRequested: 'code/changes-requested',
        approved: 'code/approved'
      }
    }
  }
};

const orgsConfigs = {
  ornikar: config,
  christophehurpeau: config$1
}; // flat requires node 11
// export const getMembers = <GroupNames extends string = any>(
//   groups: Record<GroupNames, Group>,
// ): string[] => {
//   return Object.values(groups).flat(1);
// };

const options = ['featureBranch', 'autoMergeWithSkipCi', 'autoMerge', 'deleteAfterMerge'];
const optionsRegexps = options.map(option => ({
  name: option,
  regexp: new RegExp(`\\[([ xX]?)]\\s*<!-- reviewflow-${option} -->`)
}));
const optionsLabels = [{
  name: 'featureBranch',
  label: 'This PR is a feature branch'
}, {
  name: 'autoMergeWithSkipCi',
  label: 'Auto merge with `[skip ci]`'
}, {
  name: 'autoMerge',
  label: 'Auto merge when this PR is ready and has no failed statuses. (Also has a queue per repo to prevent multiple useless "Update branch" triggers)'
}, {
  name: 'deleteAfterMerge',
  label: 'Automatic branch delete after this PR is merged'
}];

const commentStart = '<!-- do not edit after this -->';
const commentEnd = "<!-- end - don't add anything after this -->";
const regexpCols = /^(.*)(<!---? do not edit after this -?-->(.*)<!---? end - don't add anything after this -?-->)(.*)$/is;
const regexpReviewflowCol = /^(\s*<!---? do not edit after this -?--><\/td><td [^>]*>)\s*(.*)\s*(<\/td><\/tr><\/table>\s*<!---? end - don't add anything after this -?-->)\s*$/is;

const parseOptions = (content, defaultConfig) => {
  return optionsRegexps.reduce((acc, {
    name,
    regexp
  }) => {
    const match = regexp.exec(content);
    acc[name] = !match ? defaultConfig[name] || false : match[1] === 'x' || match[1] === 'X';
    return acc;
  }, {});
};

const parseBody = (description, defaultConfig) => {
  const match = regexpCols.exec(description);
  if (!match) return null;
  const [, content, reviewFlowCol, reviewflowContent, ending] = match;
  const reviewFlowColMatch = regexpReviewflowCol.exec(reviewFlowCol);

  if (!reviewFlowColMatch) {
    return {
      content,
      ending,
      reviewflowContentCol: reviewflowContent,
      reviewflowContentColPrefix: commentStart,
      reviewflowContentColSuffix: commentEnd,
      options: parseOptions(reviewFlowCol, defaultConfig)
    };
  }

  const [, reviewflowContentColPrefix, reviewflowContentCol, reviewflowContentColSuffix] = reviewFlowColMatch;
  return {
    content,
    ending,
    reviewflowContentCol,
    reviewflowContentColPrefix,
    reviewflowContentColSuffix,
    options: parseOptions(reviewflowContentCol, defaultConfig)
  };
};

/* eslint-disable max-lines */

const hasFailedStatusOrChecks = async (context, repoContext, pr) => {
  const checks = await context.github.checks.listForRef(context.repo({
    ref: pr.head.sha,
    per_page: 100
  }));
  const failedChecks = checks.data.check_runs.filter(check => check.conclusion === 'failure');

  if (failedChecks.length !== 0) {
    context.log.info(`automerge not possible: failed check pr ${pr.id}`, {
      checks: failedChecks.map(check => check.name)
    });
    return true;
  }

  const combinedStatus = await context.github.repos.getCombinedStatusForRef(context.repo({
    ref: pr.head.sha,
    per_page: 100
  }));

  if (combinedStatus.data.state === 'failure') {
    const failedStatuses = combinedStatus.data.statuses.filter(status => status.state === 'failure' || status.state === 'error');
    context.log.info(`automerge not possible: failed status pr ${pr.id}`, {
      statuses: failedStatuses.map(status => status.context)
    });
    return true;
  }

  return false;
};

const autoMergeIfPossible = async (context, repoContext, pr = context.payload.pull_request, prLabels = pr.labels) => {
  const autoMergeLabel = repoContext.labels['merge/automerge'];
  if (!autoMergeLabel) return false;

  const createMergeLockPrFromPr = () => ({
    id: pr.id,
    number: pr.number,
    branch: pr.head.ref
  });

  if (!prLabels.find(l => l.id === autoMergeLabel.id)) {
    context.log.debug('automerge not possible: no label', {
      prId: pr.id,
      prNumber: pr.number
    });
    repoContext.removePrFromAutomergeQueue(context, pr.number);
    return false;
  }

  if (pr.state !== 'open') {
    context.log.debug('automerge not possible: pr is not opened', {
      prId: pr.id,
      prNumber: pr.number
    });
    repoContext.removePrFromAutomergeQueue(context, pr.number);
  }

  if (repoContext.hasNeedsReview(prLabels) || repoContext.hasRequestedReview(prLabels)) {
    context.log.debug('automerge not possible: blocking labels', {
      prId: pr.id,
      prNumber: pr.number
    }); // repoContext.removePrFromAutomergeQueue(context, pr.number);

    return false;
  }

  const lockedPr = repoContext.getMergeLockedPr();

  if (lockedPr && lockedPr.number !== pr.number) {
    context.log.info('automerge not possible: locked pr', {
      prId: pr.id,
      prNumber: pr.number
    });
    repoContext.pushAutomergeQueue(createMergeLockPrFromPr());
    return false;
  }

  repoContext.addMergeLockPr(createMergeLockPrFromPr());

  if (pr.mergeable === undefined) {
    const prResult = await context.github.pulls.get(context.repo({
      pull_number: pr.number
    }));
    pr = prResult.data;
  }

  if (pr.merged) {
    repoContext.removePrFromAutomergeQueue(context, pr.number);
    context.log.info('automerge not possible: already merged pr', {
      prId: pr.id,
      prNumber: pr.number
    });
    return false;
  }

  context.log.info(`automerge?: ${pr.id}, #${pr.number}, mergeable=${pr.mergeable} state=${pr.mergeable_state}`); // https://github.com/octokit/octokit.net/issues/1763

  if (!(pr.mergeable_state === 'clean' || pr.mergeable_state === 'has_hooks' || pr.mergeable_state === 'unstable')) {
    if (!pr.mergeable_state || pr.mergeable_state === 'unknown') {
      context.log.info(`automerge not possible: rescheduling ${pr.id}`); // GitHub is determining whether the pull request is mergeable

      repoContext.reschedule(context, createMergeLockPrFromPr());
      return false;
    }

    if (pr.head.ref.startsWith('renovate/')) {
      if (pr.mergeable_state === 'behind' || pr.mergeable_state === 'dirty') {
        context.log.info(`automerge not possible: rebase renovate branch pr ${pr.id}`); // TODO check if has commits not made by renovate https://github.com/ornikar/shared-configs/pull/47#issuecomment-445767120

        await context.github.issues.update(context.repo({
          number: pr.number,
          body: pr.body.replace('[ ] <!-- renovate-rebase -->', '[x] <!-- renovate-rebase -->')
        }));
        return false;
      }

      if (await hasFailedStatusOrChecks(context, repoContext, pr)) {
        repoContext.removePrFromAutomergeQueue(context, pr.number);
        return false;
      } else if (pr.mergeable_state === 'blocked') {
        // waiting for reschedule in status (pr-handler/status.ts)
        return false;
      }

      context.log.info(`automerge not possible: renovate with mergeable_state=${pr.mergeable_state}`);
      return false;
    }

    if (pr.mergeable_state === 'blocked') {
      if (await hasFailedStatusOrChecks(context, repoContext, pr)) {
        repoContext.removePrFromAutomergeQueue(context, pr.number);
        return false;
      } else {
        // waiting for reschedule in status (pr-handler/status.ts)
        return false;
      }
    }

    if (pr.mergeable_state === 'behind') {
      context.log.info('automerge not possible: update branch', {
        head: pr.head.ref,
        base: pr.base.ref
      });
      await context.github.repos.merge({
        owner: pr.head.repo.owner.login,
        repo: pr.head.repo.name,
        head: pr.base.ref,
        base: pr.head.ref
      });
      return false;
    }

    repoContext.removePrFromAutomergeQueue(context, pr.number);
    context.log.info(`automerge not possible: not mergeable mergeable_state=${pr.mergeable_state}`);
    return false;
  }

  try {
    context.log.info(`automerge pr #${pr.number}`);
    const parsedBody = parseBody(pr.body, repoContext.config.prDefaultOptions);
    const options = parsedBody && parsedBody.options || repoContext.config.prDefaultOptions;
    const mergeResult = await context.github.pulls.merge({
      merge_method: options.featureBranch ? 'merge' : 'squash',
      owner: pr.head.repo.owner.login,
      repo: pr.head.repo.name,
      pull_number: pr.number,
      commit_title: `${pr.title}${options.autoMergeWithSkipCi ? ' [skip ci]' : ''} (#${pr.number})`,
      commit_message: '' // TODO add BC

    });
    context.log.debug('merge result:', mergeResult.data);
    repoContext.removePrFromAutomergeQueue(context, pr.number);
    return Boolean(mergeResult.data.merged);
  } catch (err) {
    context.log.info('could not merge:', err.message);
    repoContext.reschedule(context, createMergeLockPrFromPr());
    return false;
  }
};

const initRepoLabels = async (context, config) => {
  const {
    data: labels
  } = await context.github.issues.listLabelsForRepo(context.repo({
    per_page: 100
  }));
  const finalLabels = {};

  for (const [labelKey, labelConfig] of Object.entries(config.labels.list)) {
    const labelColor = labelConfig.color.slice(1);
    const description = `Generated by review-flow for ${labelKey}`;
    let existingLabel = labels.find(label => label.name === labelConfig.name);

    if (!existingLabel) {
      existingLabel = labels.find(label => label.description === description);
    }

    if (!existingLabel) {
      if (labelKey === 'design/needs-review') {
        existingLabel = labels.find(label => label.name === 'needs-design-review');
      }

      if (labelKey === 'design/approved') {
        existingLabel = labels.find(label => label.name === 'design-reviewed');
      }
    }

    if (!existingLabel) {
      const result = await context.github.issues.createLabel(context.repo({
        name: labelConfig.name,
        color: labelColor,
        description
      }));
      finalLabels[labelKey] = result.data;
    } else if (existingLabel.name !== labelConfig.name || existingLabel.color !== labelColor // ||
    // TODO: description is never updated
    // existingLabel.description !== description
    ) {
        context.log.info('Needs to update label', {
          current_name: existingLabel.name,
          name: existingLabel.name !== labelConfig.name && labelConfig.name,
          color: existingLabel.color !== labelColor && labelColor,
          description: existingLabel.description !== description && description
        });
        const result = await context.github.issues.updateLabel(context.repo({
          current_name: existingLabel.name,
          name: labelConfig.name,
          color: labelColor,
          description
        }));
        finalLabels[labelKey] = result.data;
      } else {
      finalLabels[labelKey] = existingLabel;
    }
  }

  return finalLabels;
};

const getKeys = o => Object.keys(o);

const ExcludesFalsy = Boolean;
const initTeamSlack = async (context, config) => {
  if (!config.slackToken) {
    return {
      mention: () => '',
      postMessage: () => Promise.resolve()
    };
  }

  const githubLoginToSlackEmail = getKeys(config.groups).reduce((acc, groupName) => {
    Object.assign(acc, config.groups[groupName]);
    return acc;
  }, {});
  const slackClient = new webApi.WebClient(config.slackToken);
  const allUsers = await slackClient.users.list({
    limit: 200
  });
  const members = Object.values(githubLoginToSlackEmail).map(email => {
    const member = allUsers.members.find(user => user.profile.email === email);

    if (!member) {
      console.warn(`Could not find user ${email}`);
      return;
    }

    return [email, {
      member,
      im: undefined
    }];
  }).filter(ExcludesFalsy);

  for (const [, user] of members) {
    try {
      const im = await slackClient.im.open({
        user: user.member.id
      });
      user.im = im.channel;
    } catch (err) {
      console.error(err);
    }
  }

  const membersMap = new Map(members);

  const getUserFromGithubLogin = githubLogin => {
    const email = githubLoginToSlackEmail[githubLogin];
    if (!email) return null;
    return membersMap.get(email);
  };

  return {
    mention: githubLogin => {
      const user = getUserFromGithubLogin(githubLogin);
      if (!user) return githubLogin;
      return `<@${user.member.id}>`;
    },
    postMessage: async (githubLogin, text) => {
      context.log.info('send slack', {
        githubLogin,
        text
      });
      if (process.env.DRY_RUN) return;
      const user = getUserFromGithubLogin(githubLogin);
      if (!user || !user.im) return;
      await slackClient.chat.postMessage({
        channel: user.im.id,
        text
      });
    }
  };
};

const ExcludesFalsy$1 = Boolean;

const initTeamContext = async (context, config) => {
  const slackPromise = initTeamSlack(context, config);
  const githubLoginToGroup = new Map();
  getKeys(config.groups).forEach(groupName => {
    Object.keys(config.groups[groupName]).forEach(login => {
      githubLoginToGroup.set(login, groupName);
    });
  });
  const githubLoginToTeams = new Map();
  getKeys(config.teams || {}).forEach(teamName => {
    config.teams[teamName].logins.forEach(login => {
      const teams = githubLoginToTeams.get(login);

      if (teams) {
        teams.push(teamName);
      } else {
        githubLoginToTeams.set(login, [teamName]);
      }
    });
  });

  const getReviewerGroups = githubLogins => [...new Set(githubLogins.map(githubLogin => githubLoginToGroup.get(githubLogin)).filter(Boolean))];

  return {
    config,
    getReviewerGroup: githubLogin => githubLoginToGroup.get(githubLogin),
    getReviewerGroups: githubLogins => [...new Set(githubLogins.map(githubLogin => githubLoginToGroup.get(githubLogin)).filter(ExcludesFalsy$1))],
    getTeamsForLogin: githubLogin => githubLoginToTeams.get(githubLogin) || [],
    reviewShouldWait: (reviewerGroup, requestedReviewers, {
      includesReviewerGroup,
      includesWaitForGroups
    }) => {
      if (!reviewerGroup) return false;
      const requestedReviewerGroups = getReviewerGroups(requestedReviewers.map(request => request.login)); // contains another request of a reviewer in the same group

      if (includesReviewerGroup && requestedReviewerGroups.includes(reviewerGroup)) {
        return true;
      } // contains a request from a dependent group


      if (config.waitForGroups && includesWaitForGroups) {
        const waitForGroups = config.waitForGroups;
        return requestedReviewerGroups.some(group => waitForGroups[reviewerGroup].includes(group));
      }

      return false;
    },
    slack: await slackPromise
  };
};

const orgContextsPromise = new Map();
const orgContexts = new Map();
const obtainOrgContext = (context, config) => {
  const owner = context.payload.repository.owner;
  const existingTeamContext = orgContexts.get(owner.login);
  if (existingTeamContext) return existingTeamContext;
  const existingPromise = orgContextsPromise.get(owner.login);
  if (existingPromise) return Promise.resolve(existingPromise);
  const promise = initTeamContext(context, config);
  orgContextsPromise.set(owner.login, promise);
  return promise.then(orgContext => {
    orgContextsPromise.delete(owner.login);
    orgContexts.set(owner.login, orgContext);
    return orgContext;
  });
};

/* eslint-disable max-lines */
const ExcludesFalsy$2 = Boolean;

async function initRepoContext(context, config) {
  const orgContext = await obtainOrgContext(context, config);
  const repoContext = Object.create(orgContext);
  const [labels] = await Promise.all([initRepoLabels(context, config)]);
  const reviewGroupNames = Object.keys(config.groups);
  const needsReviewLabelIds = reviewGroupNames.map(key => config.labels.review[key].needsReview).filter(Boolean).map(name => labels[name].id);
  const requestedReviewLabelIds = reviewGroupNames.map(key => config.labels.review[key].requested).filter(Boolean).map(name => labels[name].id);
  const changesRequestedLabelIds = reviewGroupNames.map(key => config.labels.review[key].changesRequested).filter(Boolean).map(name => labels[name].id);
  const approvedReviewLabelIds = reviewGroupNames.map(key => config.labels.review[key].approved).filter(Boolean).map(name => labels[name].id);
  const protectedLabelIds = [...requestedReviewLabelIds, ...changesRequestedLabelIds, ...approvedReviewLabelIds];
  const labelIdToGroupName = new Map();
  reviewGroupNames.forEach(key => {
    const reviewGroupLabels = config.labels.review[key];
    Object.keys(reviewGroupLabels).forEach(labelKey => {
      labelIdToGroupName.set(labels[reviewGroupLabels[labelKey]].id, key);
    });
  }); // const updateStatusCheck = (context, reviewGroup, statusInfo) => {};

  const lock$1 = lock.Lock();
  let lockMergePr;
  let automergeQueue = [];

  const lockPROrPRS = (prIdOrIds, callback) => new Promise((resolve, reject) => {
    console.log('lock: try to lock pr', {
      prIdOrIds
    });
    lock$1(prIdOrIds, async createReleaseCallback => {
      const release = createReleaseCallback(() => {});
      console.log('lock: lock acquired', {
        prIdOrIds
      });

      try {
        await callback();
      } catch (err) {
        console.log('lock: release pr (with error)', {
          prIdOrIds
        });
        release();
        reject(err);
        return;
      }

      console.log('lock: release pr', {
        prIdOrIds
      });
      release();
      resolve();
    });
  });

  const reschedule = (context, pr) => {
    if (!pr) throw new Error('Cannot reschedule undefined');
    context.log.info('reschedule', pr);
    setTimeout(() => {
      lockPROrPRS('reschedule', () => {
        return lockPROrPRS(String(pr.id), async () => {
          const prResult = await context.github.pulls.get(context.repo({
            pull_number: pr.number
          }));
          await autoMergeIfPossible(context, repoContext, prResult.data);
        });
      });
    }, 1000);
  };

  return Object.assign(repoContext, {
    labels,
    protectedLabelIds,
    hasNeedsReview: labels => labels.some(label => needsReviewLabelIds.includes(label.id)),
    hasRequestedReview: labels => labels.some(label => requestedReviewLabelIds.includes(label.id)),
    hasChangesRequestedReview: labels => labels.some(label => changesRequestedLabelIds.includes(label.id)),
    hasApprovesReview: labels => labels.some(label => approvedReviewLabelIds.includes(label.id)),
    getNeedsReviewGroupNames: labels => labels.filter(label => needsReviewLabelIds.includes(label.id)).map(label => labelIdToGroupName.get(label.id)).filter(ExcludesFalsy$2),
    getMergeLockedPr: () => lockMergePr,
    addMergeLockPr: pr => {
      console.log('merge lock: lock', pr);

      if (lockMergePr && String(lockMergePr.number) === String(pr.number)) {
        return;
      }

      if (lockMergePr) throw new Error('Already have lock');
      lockMergePr = pr;
    },
    removePrFromAutomergeQueue: (context, prNumber) => {
      context.log('merge lock: remove', {
        prNumber
      });

      if (lockMergePr && String(lockMergePr.number) === String(prNumber)) {
        lockMergePr = automergeQueue.shift();
        context.log('merge lock: next', {
          lockMergePr
        });

        if (lockMergePr) {
          reschedule(context, lockMergePr);
        }
      } else {
        automergeQueue = automergeQueue.filter(value => String(value.number) !== String(prNumber));
      }
    },
    pushAutomergeQueue: pr => {
      console.log('merge lock: push queue', {
        pr,
        lockMergePr,
        automergeQueue
      });

      if (!automergeQueue.some(p => p.number === pr.number)) {
        automergeQueue.push(pr);
      }
    },
    reschedule,
    lockPROrPRS
  });
}

const repoContextsPromise = new Map();
const repoContexts = new Map();
const obtainRepoContext = context => {
  const repo = context.payload.repository;

  if (repo.name === 'reviewflow-test' && process.env.NAME !== 'reviewflow-test') {
    return null;
  }

  const owner = repo.owner;

  if (!orgsConfigs[owner.login]) {
    console.warn(owner.login, Object.keys(orgsConfigs));
    return null;
  }

  const key = repo.id;
  const existingRepoContext = repoContexts.get(key);
  if (existingRepoContext) return existingRepoContext;
  const existingPromise = repoContextsPromise.get(key);
  if (existingPromise) return Promise.resolve(existingPromise);
  const promise = initRepoContext(context, orgsConfigs[owner.login]);
  repoContextsPromise.set(key, promise);
  return promise.then(repoContext => {
    repoContextsPromise.delete(key);
    repoContexts.set(key, repoContext);
    return repoContext;
  });
};

const handlerPullRequestChange = async (context, callback) => {
  const repoContext = await obtainRepoContext(context);
  if (!repoContext) return;
  repoContext.lockPROrPRS(String(context.payload.pull_request.id), async () => {
    await callback(repoContext);
  });
};
const createHandlerPullRequestChange = callback => context => {
  return handlerPullRequestChange(context, repoContext => callback(context, repoContext));
};
const createHandlerPullRequestsChange = (getPullRequests, callback) => async context => {
  const repoContext = await obtainRepoContext(context);
  if (!repoContext) return;
  const prs = getPullRequests(context, repoContext);
  if (prs.length === 0) return;
  return repoContext.lockPROrPRS(prs.map(pr => String(pr.id)), () => callback(context, repoContext));
};

const autoAssignPRToCreator = async (context, repoContext) => {
  if (!repoContext.config.autoAssignToCreator) return;
  const pr = context.payload.pull_request;
  if (pr.assignees.length !== 0) return;
  if (pr.user.type === 'Bot') return;
  await context.github.issues.addAssignees(context.issue({
    assignees: [pr.user.login]
  }));
};

const cleanTitle = title => title.trim().replace(/[\s-]+\[?\s*ONK[- ](\d+)\s*]?\s*$/i, ' ONK-$1').replace(/^([A-Za-z]+)[/:]\s*/, (s, arg1) => `${arg1.toLowerCase()}: `).replace(/^Revert "([^"]+)"$/, 'revert: $1') // eslint-disable-next-line unicorn/no-unsafe-regex
.replace(/^(revert:.*)(\s+\(#\d+\))$/, '$1');

const toMarkdownOptions = options => {
  return optionsLabels.map(({
    name,
    label
  }) => `- [${options[name] ? 'x' : ' '}] <!-- reviewflow-${name} -->${label}`).join('\n');
};

const toMarkdownInfos = infos => {
  return infos.map(info => {
    if (info.url) return `[${info.title}](${info.url})`;
    return info.title;
  }).join('\n');
};

const updateBody = (body, defaultConfig, infos, updateOptions) => {
  const parsed = parseBody(body, defaultConfig);

  if (!parsed) {
    console.info('could not parse body');
    return {
      body
    };
  }

  const {
    content,
    ending,
    reviewflowContentCol,
    reviewflowContentColPrefix,
    reviewflowContentColSuffix,
    options
  } = parsed; // eslint-disable-next-line no-nested-ternary

  const infosParagraph = !infos ? reviewflowContentCol.replace( // eslint-disable-next-line unicorn/no-unsafe-regex
  /^\s*(?:(#### Infos:.*)?#### Options:)?.*$/s, '$1') : infos.length !== 0 ? `#### Infos:\n${toMarkdownInfos(infos)}\n` : '';
  const updatedOptions = !updateOptions ? options : { ...options,
    ...updateOptions
  };
  return {
    options: updatedOptions,
    body: `${content}${reviewflowContentColPrefix}
${infosParagraph}#### Options:
${toMarkdownOptions(updatedOptions)}
${reviewflowContentColSuffix}${ending || ''}`
  };
};

const ExcludesFalsy$3 = Boolean;
const editOpenedPR = async (context, repoContext) => {
  const repo = context.payload.repository;
  const pr = context.payload.pull_request; // do not lint pr from forks

  if (pr.head.repo.id !== repo.id) return {
    skipAutoMerge: true
  };
  const title = repoContext.config.trimTitle ? cleanTitle(pr.title) : pr.title;
  const isPrFromBot = pr.user.type === 'Bot';
  const statuses = [];
  const errorRule = repoContext.config.parsePR.title.find(rule => {
    if (rule.bot === false && isPrFromBot) return false;
    const match = rule.regExp.exec(pr.title);

    if (match === null) {
      if (rule.status) {
        statuses.push({
          name: rule.status,
          error: rule.error
        });
      }

      return true;
    }

    if (rule.status && rule.statusInfoFromMatch) {
      statuses.push({
        name: rule.status,
        info: rule.statusInfoFromMatch(match)
      });
      return false;
    }

    return false;
  });
  const date = new Date().toISOString();
  const hasLintPrCheck = (await context.github.checks.listForRef(context.repo({
    ref: pr.head.sha
  }))).data.check_runs.find(check => check.name === `${process.env.NAME}/lint-pr`);
  await Promise.all([...statuses.map(({
    name,
    error,
    info
  }) => context.github.repos.createStatus(context.repo({
    context: `${process.env.NAME}/${name}`,
    sha: pr.head.sha,
    state: error ? 'failure' : 'success',
    target_url: error ? undefined : info.url,
    description: error ? error.title : info.title
  }))), hasLintPrCheck && context.github.checks.create(context.repo({
    name: `${process.env.NAME}/lint-pr`,
    head_sha: pr.head.sha,
    status: 'completed',
    conclusion: errorRule ? 'failure' : 'success',
    started_at: date,
    completed_at: date,
    output: errorRule ? errorRule.error : {
      title: '✓ Your PR is valid',
      summary: ''
    }
  })), !hasLintPrCheck && context.github.repos.createStatus(context.repo({
    context: `${process.env.NAME}/lint-pr`,
    sha: pr.head.sha,
    state: errorRule ? 'failure' : 'success',
    target_url: undefined,
    description: errorRule ? errorRule.error.title : '✓ Your PR is valid'
  }))].filter(ExcludesFalsy$3));
  const featureBranchLabel = repoContext.labels['feature-branch'];
  const automergeLabel = repoContext.labels['merge/automerge'];
  const prHasFeatureBranchLabel = Boolean(featureBranchLabel && pr.labels.find(label => label.id === featureBranchLabel.id));
  const prHasAutoMergeLabel = Boolean(automergeLabel && pr.labels.find(label => label.id === automergeLabel.id));
  const defaultOptions = { ...repoContext.config.prDefaultOptions,
    autoMerge: prHasAutoMergeLabel,
    featureBranch: prHasFeatureBranchLabel
  };
  const {
    body,
    options
  } = updateBody(pr.body, defaultOptions, statuses.filter(status => status.info && status.info.inBody).map(status => status.info));
  const hasDiffInTitle = pr.title !== title;
  const hasDiffInBody = pr.body !== body;

  if (hasDiffInTitle || hasDiffInBody) {
    const update = {};

    if (hasDiffInTitle) {
      update.title = title;
      pr.title = title;
    }

    if (hasDiffInBody) {
      update.body = body;
      pr.body = body;
    }

    await context.github.issues.update(context.issue(update));
  }

  if (options && (featureBranchLabel || automergeLabel)) {
    if (featureBranchLabel) {
      if (prHasFeatureBranchLabel && !options.featureBranch) {
        await context.github.issues.removeLabel(context.issue({
          name: featureBranchLabel.name
        }));
      }

      if (options.featureBranch && !prHasFeatureBranchLabel) {
        await context.github.issues.addLabels(context.issue({
          labels: [featureBranchLabel.name]
        }));
      }
    }

    if (automergeLabel) {
      if (prHasAutoMergeLabel && !options.autoMerge) {
        await context.github.issues.removeLabel(context.issue({
          name: automergeLabel.name
        }));
        repoContext.removePrFromAutomergeQueue(context, pr.number);
      }

      if (options.autoMerge && !prHasAutoMergeLabel) {
        const result = await context.github.issues.addLabels(context.issue({
          labels: [automergeLabel.name]
        }));
        await autoMergeIfPossible(context, repoContext, context.payload.pull_request, result.data);
      }

      return {
        skipAutoMerge: true
      };
    }
  }

  return {
    skipAutoMerge: false
  };
};

const addStatusCheck = async function (context, pr, {
  state,
  description
}) {
  const hasPrCheck = (await context.github.checks.listForRef(context.repo({
    ref: pr.head.sha
  }))).data.check_runs.find(check => check.name === process.env.NAME);
  context.log.info('add status check', {
    hasPrCheck,
    state,
    description
  });

  if (hasPrCheck) {
    await context.github.checks.create(context.repo({
      name: process.env.NAME,
      head_sha: pr.head.sha,
      started_at: pr.created_at,
      status: 'completed',
      conclusion: state,
      completed_at: new Date().toISOString(),
      output: {
        title: description,
        summary: ''
      }
    }));
  } else {
    await context.github.repos.createStatus(context.repo({
      context: process.env.NAME,
      sha: pr.head.sha,
      state,
      target_url: undefined,
      description
    }));
  }
};

const createFailedStatusCheck = (context, pr, description) => addStatusCheck(context, pr, {
  state: 'failure',
  description
});

const updateStatusCheckFromLabels = (context, repoContext, pr = context.payload.pull_request, labels = pr.labels || []) => {
  context.log.info('updateStatusCheckFromLabels', {
    labels: labels.map(l => l && l.name),
    hasNeedsReview: repoContext.hasNeedsReview(labels),
    hasApprovesReview: repoContext.hasApprovesReview(labels)
  });

  if (pr.requested_reviewers.length !== 0) {
    return createFailedStatusCheck(context, pr, `Awaiting review from: ${pr.requested_reviewers.map(rr => rr.login).join(', ')}`);
  }

  if (repoContext.hasChangesRequestedReview(labels)) {
    return createFailedStatusCheck(context, pr, 'Changes requested ! Push commits or discuss changes then re-request a review.');
  }

  const needsReviewGroupNames = repoContext.getNeedsReviewGroupNames(labels);

  if (needsReviewGroupNames.length !== 0) {
    return createFailedStatusCheck(context, pr, `Awaiting review from: ${needsReviewGroupNames.join(', ')}. Perhaps request someone ?`);
  }

  if (!repoContext.hasApprovesReview(labels)) {
    if (repoContext.config.requiresReviewRequest) {
      return createFailedStatusCheck(context, pr, 'Awaiting review... Perhaps request someone ?');
    }
  } // if (
  //   repoContext.config.requiresReviewRequest &&
  //   !repoContext.hasRequestedReview(labels)
  // ) {
  //   return  createFailedStatusCheck(
  //     context,
  //     pr,
  //     'You need to request someone to review the PR',
  //   );
  //   return;
  // }
  // return  createInProgressStatusCheck(context);
  // } else if (repoContext.hasApprovesReview(labels)) {


  return addStatusCheck(context, pr, {
    state: 'success',
    description: '✓ PR ready to merge !'
  }); // }
};

const updateReviewStatus = async (context, repoContext, reviewGroup, {
  add: labelsToAdd,
  remove: labelsToRemove
}) => {
  context.log.info('updateReviewStatus', {
    reviewGroup,
    labelsToAdd,
    labelsToRemove
  });
  const pr = context.payload.pull_request;
  let prLabels = pr.labels || [];
  if (!reviewGroup) return prLabels;
  const newLabelNames = new Set(prLabels.map(label => label.name));
  const toAdd = new Set();
  const toDelete = new Set();
  const labels = repoContext.labels;

  const getLabelFromKey = key => {
    const reviewConfig = repoContext.config.labels.review[reviewGroup];
    if (!reviewConfig) return undefined;
    return reviewConfig[key] && labels[reviewConfig[key]] ? labels[reviewConfig[key]] : undefined;
  };

  if (labelsToAdd) {
    labelsToAdd.forEach(key => {
      if (!key) return;
      const label = getLabelFromKey(key);

      if (!label || prLabels.some(prLabel => prLabel.id === label.id)) {
        return;
      }

      newLabelNames.add(label.name);
      toAdd.add(key);
    });
  }

  if (labelsToRemove) {
    labelsToRemove.forEach(key => {
      if (!key) return;
      const label = getLabelFromKey(key);
      if (!label) return;
      const existing = prLabels.find(prLabel => prLabel.id === label.id);

      if (existing) {
        newLabelNames.delete(existing.name);
        toDelete.add(key);
      }
    });
  } // TODO move that elsewhere


  repoContext.getTeamsForLogin(pr.user.login).forEach(teamName => {
    const team = repoContext.config.teams[teamName];

    if (team.labels) {
      team.labels.forEach(labelKey => {
        const label = repoContext.labels[labelKey];

        if (label && !prLabels.some(prLabel => prLabel.id === label.id)) {
          newLabelNames.add(label.name);
          toAdd.add(labelKey);
        }
      });
    }
  });
  const newLabelNamesArray = [...newLabelNames];
  context.log.info('updateReviewStatus', {
    reviewGroup,
    toAdd: [...toAdd],
    toDelete: [...toDelete],
    oldLabels: prLabels.map(l => l.name),
    newLabelNames: newLabelNamesArray
  }); // if (process.env.DRY_RUN) return;

  if (toAdd.size || toDelete.size) {
    const result = await context.github.issues.replaceLabels(context.issue({
      labels: newLabelNamesArray
    }));
    prLabels = result.data;
  } // if (toAdd.has('needsReview')) {
  //   createInProgressStatusCheck(context);
  // } else if (
  //   toDelete.has('needsReview') ||
  //   (prLabels.length === 0 && toAdd.size === 1 && toAdd.has('approved'))
  // ) {


  await updateStatusCheckFromLabels(context, repoContext, pr, prLabels); // }

  return prLabels;
};

const autoApproveAndAutoMerge = async (context, repoContext) => {
  // const autoMergeLabel = repoContext.labels['merge/automerge'];
  const codeApprovedLabel = repoContext.labels['code/approved'];
  const prLabels = context.payload.pull_request.labels;

  if (prLabels.find(l => l.id === codeApprovedLabel.id)) {
    await context.github.pulls.createReview(context.issue({
      event: 'APPROVE'
    }));
  }

  await autoMergeIfPossible(context, repoContext);
};

function opened(app) {
  app.on('pull_request.opened', createHandlerPullRequestChange(async (context, repoContext) => {
    const fromRenovate = context.payload.pull_request.head.ref.startsWith('renovate/');
    await Promise.all([autoAssignPRToCreator(context, repoContext), editOpenedPR(context, repoContext), fromRenovate ? autoApproveAndAutoMerge(context, repoContext) : updateReviewStatus(context, repoContext, 'dev', {
      add: ['needsReview'],
      remove: ['approved', 'changesRequested']
    })]);
  }));
}

function closed(app) {
  app.on('pull_request.closed', createHandlerPullRequestChange(async (context, repoContext) => {
    const repo = context.payload.repository;
    const pr = context.payload.pull_request;

    if (pr.merged) {
      const parsedBody = pr.head.repo.id === repo.id && parseBody(pr.body, repoContext.config.prDefaultOptions);
      await Promise.all([repoContext.removePrFromAutomergeQueue(context, pr.number), parsedBody && parsedBody.options.deleteAfterMerge ? context.github.git.deleteRef(context.repo({
        ref: `heads/${pr.head.ref}`
      })).catch(() => {}) : undefined]);
    } else {
      await Promise.all([repoContext.removePrFromAutomergeQueue(context, pr.number), updateReviewStatus(context, repoContext, 'dev', {
        remove: ['needsReview']
      })]);
    }
  }));
}

function reviewRequested(app) {
  app.on('pull_request.review_requested', createHandlerPullRequestChange(async (context, repoContext) => {
    const sender = context.payload.sender; // ignore if sender is self (dismissed review rerequest review)

    if (sender.type === 'Bot') return;
    const pr = context.payload.pull_request;
    const reviewer = context.payload.requested_reviewer;
    const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);

    // repoContext.reviewShouldWait(reviewerGroup, pr.requested_reviewers, { includesWaitForGroups: true });
    if (reviewerGroup && repoContext.config.labels.review[reviewerGroup]) {
      const {
        data: reviews
      } = await context.github.pulls.listReviews(context.issue({
        per_page: 50
      }));
      const hasChangesRequestedInReviews = reviews.some(review => repoContext.getReviewerGroup(review.user.login) === reviewerGroup && review.state === 'REQUEST_CHANGES' && // In case this is a rerequest for review
      review.user.login !== reviewer.login);

      if (!hasChangesRequestedInReviews) {
        await updateReviewStatus(context, repoContext, reviewerGroup, {
          add: ['needsReview', "requested"],
          remove: ['approved', 'changesRequested']
        });
      }
    }

    if (sender.login === reviewer.login) return;

    if (repoContext.slack) {
      repoContext.slack.postMessage(reviewer.login, `:eyes: ${repoContext.slack.mention(sender.login)} requests your review on ${pr.html_url} !\n> ${pr.title}`);
    }
  }));
}

function reviewRequestRemoved(app) {
  app.on('pull_request.review_request_removed', createHandlerPullRequestChange(async (context, repoContext) => {
    const sender = context.payload.sender;
    const pr = context.payload.pull_request;
    const reviewer = context.payload.requested_reviewer;
    const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);

    if (reviewerGroup && repoContext.config.labels.review[reviewerGroup]) {
      const hasRequestedReviewsForGroup = repoContext.reviewShouldWait(reviewerGroup, pr.requested_reviewers, {
        includesReviewerGroup: true
      });
      const {
        data: reviews
      } = await context.github.pulls.listReviews(context.issue({
        per_page: 50
      }));
      const hasChangesRequestedInReviews = reviews.some(review => repoContext.getReviewerGroup(review.user.login) === reviewerGroup && review.state === 'REQUEST_CHANGES');
      const hasApprovedInReviews = reviews.some(review => repoContext.getReviewerGroup(review.user.login) === reviewerGroup && review.state === 'APPROVED');
      const approved = !hasRequestedReviewsForGroup && !hasChangesRequestedInReviews && hasApprovedInReviews;
      await updateReviewStatus(context, repoContext, reviewerGroup, {
        add: [// if changes requested by the one which requests was removed
        hasChangesRequestedInReviews && 'changesRequested', // if was already approved by another member in the group and has no other requests waiting
        approved && 'approved'],
        // remove labels if has no other requests waiting
        remove: [approved && 'needsReview', !hasRequestedReviewsForGroup && !hasChangesRequestedInReviews && 'requested']
      });
    }

    if (sender.login === reviewer.login) return;

    if (repoContext.slack) {
      repoContext.slack.postMessage(reviewer.login, `:skull_and_crossbones: ${repoContext.slack.mention(sender.login)} removed the request for your review on ${pr.html_url}`);
    }
  }));
}

function reviewSubmitted(app) {
  app.on('pull_request_review.submitted', createHandlerPullRequestChange(async (context, repoContext) => {
    const pr = context.payload.pull_request;
    const {
      user: reviewer,
      state
    } = context.payload.review;
    if (pr.user.login === reviewer.login) return;
    const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);
    let merged;

    if (reviewerGroup && repoContext.config.labels.review[reviewerGroup]) {
      const hasRequestedReviewsForGroup = repoContext.reviewShouldWait(reviewerGroup, pr.requested_reviewers, {
        includesReviewerGroup: true // TODO reenable this when accepted can notify request review to slack (dev accepted => design requested) and flag to disable for label (approved design ; still waiting for dev ?)
        // includesWaitForGroups: true,

      });
      const {
        data: reviews
      } = await context.github.pulls.listReviews(context.issue({
        per_page: 50
      }));
      const hasChangesRequestedInReviews = reviews.some(review => repoContext.getReviewerGroup(review.user.login) === reviewerGroup && review.state === 'REQUEST_CHANGES');
      const approved = !hasRequestedReviewsForGroup && !hasChangesRequestedInReviews && state === 'approved';
      const newLabels = await updateReviewStatus(context, repoContext, reviewerGroup, {
        add: [approved && 'approved', state === 'changes_requested' && 'changesRequested'],
        remove: [approved && 'needsReview', !(hasRequestedReviewsForGroup || state === 'changes_requested') && 'requested', state === 'approved' && !hasChangesRequestedInReviews && 'changesRequested', state === 'changes_requested' && 'approved']
      });

      if (approved && !hasChangesRequestedInReviews) {
        merged = await autoMergeIfPossible(context, repoContext, pr, newLabels);
      }
    }

    const mention = repoContext.slack.mention(reviewer.login);
    const prUrl = pr.html_url;

    const message = (() => {
      if (state === 'changes_requested') {
        return `:x: ${mention} requests changes on ${prUrl}`;
      }

      if (state === 'approved') {
        return `:clap: :white_check_mark: ${mention} approves ${prUrl}${merged ? ' and PR is merged :tada:' : ''}`;
      }

      return `:speech_balloon: ${mention} commented on ${prUrl}`;
    })();

    repoContext.slack.postMessage(pr.user.login, message);
  }));
}

function reviewDismissed(app) {
  app.on('pull_request_review.dismissed', createHandlerPullRequestChange(async (context, repoContext) => {
    const sender = context.payload.sender;
    const pr = context.payload.pull_request;
    const reviewer = context.payload.review.user;
    const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);

    if (reviewerGroup && repoContext.config.labels.review[reviewerGroup]) {
      const {
        data: reviews
      } = await context.github.pulls.listReviews(context.issue({
        per_page: 50
      }));
      const hasChangesRequestedInReviews = reviews.some(review => repoContext.getReviewerGroup(review.user.login) === reviewerGroup && review.state === 'REQUEST_CHANGES');
      await updateReviewStatus(context, repoContext, reviewerGroup, {
        add: ['needsReview', 'requested'],
        remove: [!hasChangesRequestedInReviews && 'changesRequested', 'approved']
      });
    }

    if (repoContext.slack) {
      if (sender.login === reviewer.login) {
        repoContext.slack.postMessage(pr.user.login, `:skull: ${repoContext.slack.mention(reviewer.login)} dismissed his review on ${pr.html_url}`);
      } else {
        repoContext.slack.postMessage(reviewer.login, `:skull: ${repoContext.slack.mention(sender.login)} dismissed your review on ${pr.html_url}`);
      }
    }
  }));
}

function synchronize(app) {
  app.on('pull_request.synchronize', createHandlerPullRequestChange(async (context, repoContext) => {
    // old and new sha
    // const { before, after } = context.payload;
    await Promise.all([editOpenedPR(context, repoContext), // addStatusCheckToLatestCommit
    updateStatusCheckFromLabels(context, repoContext), // call autoMergeIfPossible to re-add to the queue when push is fixed
    autoMergeIfPossible(context, repoContext)]);
  }));
}

function edited(app) {
  app.on('pull_request.edited', createHandlerPullRequestChange(async (context, repoContext) => {
    const sender = context.payload.sender;

    if (sender.type === 'Bot' && sender.login === `${process.env.NAME}[bot]`) {
      return;
    }

    const {
      skipAutoMerge
    } = await editOpenedPR(context, repoContext);
    if (!skipAutoMerge) await autoMergeIfPossible(context, repoContext);
  }));
}

const updatePrBody = async (context, repoContext, updateOptions) => {
  const prBody = context.payload.pull_request.body;
  const {
    body
  } = updateBody(prBody, repoContext.config.prDefaultOptions, undefined, updateOptions);

  if (body !== prBody) {
    await context.github.pulls.update(context.issue({
      body
    }));
  }
};

function labelsChanged(app) {
  app.on(['pull_request.labeled', 'pull_request.unlabeled'], async context => {
    const sender = context.payload.sender;
    const fromRenovate = sender.type === 'Bot' && sender.login === 'renovate[bot]';
    context.payload.pull_request.head.ref.startsWith('renovate/');

    if (sender.type === 'Bot' && !fromRenovate) {
      return;
    }

    await handlerPullRequestChange(context, async repoContext => {
      const label = context.payload.label;

      if (fromRenovate) {
        const codeApprovedLabel = repoContext.labels['code/approved'];
        const autoMergeLabel = repoContext.labels['merge/automerge'];

        if (context.payload.action === 'labeled') {
          if (codeApprovedLabel && label.id === codeApprovedLabel.id) {
            // const { data: reviews } = await context.github.pulls.listReviews(
            //   context.issue({ per_page: 1 }),
            // );
            // if (reviews.length !== 0) {
            await context.github.pulls.createReview(context.issue({
              event: 'APPROVE'
            }));
            await updateStatusCheckFromLabels(context, repoContext, context.payload.pull_request);
            await updatePrBody(context, repoContext, {
              autoMergeWithSkipCi: true
            }); // }
          } else if (autoMergeLabel && label.id === autoMergeLabel.id) {
            await updatePrBody(context, repoContext, {
              autoMerge: true
            });
          }

          await autoMergeIfPossible(context, repoContext);
        }

        return;
      }

      if (repoContext.protectedLabelIds.includes(label.id)) {
        if (context.payload.action === 'labeled') {
          await context.github.issues.removeLabel(context.issue({
            name: label.name
          }));
        } else {
          await context.github.issues.addLabels(context.issue({
            labels: [label.name]
          }));
        }

        return;
      }

      await updateStatusCheckFromLabels(context, repoContext);
      const featureBranchLabel = repoContext.labels['feature-branch'];
      const automergeLabel = repoContext.labels['merge/automerge'];

      if (featureBranchLabel && label.id === automergeLabel.id || automergeLabel && label.id === automergeLabel.id) {
        const option = featureBranchLabel && label.id === featureBranchLabel.id ? 'featureBranch' : 'autoMerge';
        await updatePrBody(context, repoContext, {
          [option]: context.payload.action === 'labeled'
        });
      } else if (context.payload.action === 'labeled') {
        if (repoContext.labels['merge/automerge'] && label.id === repoContext.labels['merge/automerge'].id) {
          await autoMergeIfPossible(context, repoContext);
        }
      }
    });
  });
}

function checkrunCompleted(app) {
  app.on('check_run.completed', createHandlerPullRequestsChange(context => context.payload.check_run.pull_requests, async (context, repoContext) => {
    await Promise.all(context.payload.check_run.pull_requests.map(pr => context.github.pulls.get(context.repo({
      number: pr.number
    })).then(prResult => {
      return autoMergeIfPossible(context, repoContext, prResult.data);
    })));
  }));
}

function checksuiteCompleted(app) {
  app.on('check_suite.completed', createHandlerPullRequestsChange(context => context.payload.check_suite.pull_requests, async (context, repoContext) => {
    await Promise.all(context.payload.check_suite.pull_requests.map(pr => context.github.pulls.get(context.repo({
      number: pr.number
    })).then(prResult => {
      return autoMergeIfPossible(context, repoContext, prResult.data);
    })));
  }));
}

const isSameBranch = (context, lockedPr) => {
  if (!lockedPr) return false;
  return !!context.payload.branches.find(b => b.name === lockedPr.branch);
};

function status(app) {
  app.on('status', createHandlerPullRequestsChange((context, repoContext) => {
    const lockedPr = repoContext.getMergeLockedPr();
    if (!lockedPr) return [];

    if (isSameBranch(context, lockedPr)) {
      return [lockedPr];
    }

    return [];
  }, (context, repoContext) => {
    const lockedPr = repoContext.getMergeLockedPr(); // check if changed

    if (isSameBranch(context, lockedPr)) {
      repoContext.reschedule(context, lockedPr);
    }
  }));
}

if (!process.env.NAME) process.env.NAME = 'reviewflow'; // const getConfig = require('probot-config')
// const { MongoClient } = require('mongodb');
// const connect = MongoClient.connect(process.env.MONGO_URL);
// const db = connect.then(client => client.db(process.env.MONGO_DB));
// let config = await getConfig(context, 'reviewflow.yml');
// eslint-disable-next-line import/no-commonjs

probot.Probot.run(app => {
  opened(app);
  closed(app);
  reviewRequested(app);
  reviewRequestRemoved(app); // app.on('pull_request.closed', async context => {
  // });
  // app.on('pull_request.reopened', async context => {
  // });

  reviewSubmitted(app);
  reviewDismissed(app);
  labelsChanged(app);
  synchronize(app);
  edited(app);
  checkrunCompleted(app);
  checksuiteCompleted(app);
  status(app);
});
//# sourceMappingURL=index-node10-dev.cjs.js.map
