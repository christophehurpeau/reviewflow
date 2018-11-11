'use strict';

const config = require('../teamconfig');
const { obtainTeamContext } = require('./teamContext');
const initRepoLabels = require('./initRepoLabels');

const initRepoContext = async (context, config) => {
  const teamContext = await obtainTeamContext(context, config);
  if (!teamContext) return null;
  const repoContext = Object.create(teamContext);

  const labels = await initRepoLabels(context, config);
  const needsReviewLabelIds = Object.keys(config.labels.review)
    .map((key) => config.labels.review[key].needsReview)
    .filter(Boolean)
    .map((name) => labels[name].id);

  const approvedReviewLabelIds = Object.keys(config.labels.review)
    .map((key) => config.labels.review[key].approved)
    .filter(Boolean)
    .map((name) => labels[name].id);

  console.log({ needsReviewLabelIds, approvedReviewLabelIds });

  const addStatusCheck = (context, statusInfo) => {
    const pr = context.payload.pull_request;

    context.log.info('addStatusCheck', {
      head_sha: pr.head.sha,
      statusInfo,
    });

    return context.github.checks.create(
      context.repo({
        name: 'reviewflow',
        head_sha: pr.head.sha,
        ...statusInfo,
      })
    );
  };

  const createInProgressStatusCheck = (context) =>
    addStatusCheck(context, {
      status: 'in_progress',
    });

  const createDoneStatusCheck = (context) =>
    addStatusCheck(context, {
      status: 'completed',
      conclusion: 'success',
      started_at: context.payload.pull_request.created_at,
      completed_at: new Date(),
      output: {
        title: '✓ All reviews done !',
        summary: 'Pull request was successfully reviewed',
      },
    });

  // const updateStatusCheck = (context, reviewGroup, statusInfo) => {};

  const hasNeedsReview = (labels) =>
    labels.some((label) => needsReviewLabelIds.includes(label.id));
  const hasApprovesReview = (labels) =>
    labels.some((label) => approvedReviewLabelIds.includes(label.id));

  const updateStatusCheckFromLabels = (
    context,
    labels = context.payload.pull_request.labels || []
  ) => {
    context.log.info('updateStatusCheckFromLabels', {
      labels,
      hasNeedsReview: hasNeedsReview(labels),
      hasApprovesReview: hasApprovesReview(labels),
    });

    if (hasNeedsReview(labels)) {
      return createInProgressStatusCheck(context);
    } else if (hasApprovesReview(labels)) {
      return createDoneStatusCheck(context);
    }
  };

  return Object.assign(repoContext, {
    updateStatusCheckFromLabels,

    updateReviewStatus: async (
      context,
      reviewGroup,
      { add: labelsToAdd, remove: labelsToRemove }
    ) => {
      const prLabels = context.payload.pull_request.labels || [];
      const newLabels = new Set(prLabels.map((label) => label.name));
      const toAdd = new Set();
      const toDelete = new Set();

      const getLabelFromKey = (key) =>
        key && labels[config.labels.review[reviewGroup][key]];

      if (labelsToAdd) {
        labelsToAdd.forEach((key) => {
          const label = getLabelFromKey(key);
          if (!label || prLabels.some((prLabel) => prLabel.id === label.id)) {
            return;
          }
          newLabels.add(label.name);
          toAdd.add(key);
        });
      }

      if (labelsToRemove) {
        labelsToRemove.forEach((key) => {
          const label = getLabelFromKey(key);
          if (!label) return;
          const existing = prLabels.find((prLabel) => prLabel.id === label.id);
          if (existing) {
            newLabels.delete(existing.name);
            toDelete.add(key);
          }
        });
      }

      context.log.info('updateReviewStatus', {
        reviewGroup,
        toAdd: [...toAdd],
        toDelete: [...toDelete],
        oldLabels: prLabels.map((l) => l.name),
        newLabels: [...newLabels],
      });

      if (process.env.DRY_RUN) return;

      if (toAdd.size || toDelete.size) {
        await context.github.issues.replaceAllLabels(
          context.issue({
            labels: [...newLabels],
          })
        );
      }

      if (toAdd.has('needsReview')) {
        createInProgressStatusCheck(context);
      } else if (toDelete.has('needsReview')) {
        updateStatusCheckFromLabels(context, [...newLabels]);
      }
    },

    addStatusCheckToLatestCommit: (context) =>
      // old and new sha
      // const { before, after } = context.payload;
      updateStatusCheckFromLabels(context),
  });
};

const repoContextsPromise = new Map();
const repoContexts = new Map();

exports.obtainRepoContext = (context) => {
  const owner = context.payload.repository.owner;
  if (owner.login !== 'ornikar') {
    console.warn(owner.login);
    return null;
  }
  const key = context.payload.repository.id;

  const existingRepoContext = repoContexts.get(key);
  if (existingRepoContext) return existingRepoContext;

  const existingPromise = repoContextsPromise.get(key);
  if (existingPromise) return Promise.resolve(existingPromise);

  const promise = initRepoContext(context, config);
  repoContextsPromise.set(key, promise);

  return promise.then((repoContext) => {
    repoContextsPromise.delete(key);
    repoContexts.set(key, repoContext);
    return repoContext;
  });
};
