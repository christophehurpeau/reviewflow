'use strict';

const config = require('../teamconfig');
const { obtainTeamContext } = require('./teamContext');
const initRepoLabels = require('./initRepoLabels');

const initRepoContext = async (context, config) => {
  const teamContext = await obtainTeamContext(context, config);
  const repoContext = Object.create(teamContext);

  const labels = await initRepoLabels(context, config);

  return Object.assign(repoContext, {
    updateLabels: async (context, { add: labelsToAdd, remove: labelsToRemove }) => {
      const prLabels = context.payload.pull_request.labels || [];
      const newLabels = new Set(prLabels.map(label => label.name));
      let modified = false;

      if (labelsToAdd) {
        labelsToAdd.map(key => key && labels[key]).forEach(label => {
          if (!label || prLabels.some(prLabel => prLabel.id === label.id)) return;
          newLabels.add(label.name);
          modified = true;
        });
      }

      if (labelsToRemove) {
        labelsToRemove.map(key => key && labels[key]).forEach(label => {
          if (!label) return;
          const existing = prLabels.find(prLabel => prLabel.id === label.id);
          if (existing) {
            newLabels.remove(existing.name);
            modified = true;
          }
        });
      }

      context.log.info('updateLabels', {
        modified,
        oldLabels: prLabels.map(l => l.name),
        newLabels: [...newLabels],
      });

      if (process.env.DRY_RUN) return;

      if (modified) {
        await context.github.issues.replaceAllLabels(
          context.issue({
            labels: [...newLabels],
          })
        );
      }
    },
  });
};

const repoContextsPromise = new Map();
const repoContexts = new Map();

exports.obtainRepoContext = context => {
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

  return promise.then(repoContext => {
    repoContextsPromise.delete(key);
    repoContexts.set(key, repoContext);
    return repoContext;
  });
};
