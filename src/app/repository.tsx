import type { Router } from 'express';
import type { ProbotOctokit } from 'probot';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Layout from '../views/Layout';
import { getUser } from './auth';

export default function repository(
  router: Router,
  octokitApp: InstanceType<typeof ProbotOctokit>,
): void {
  router.get('/repositories', async (req, res) => {
    const user = await getUser(req, res);
    if (!user) return;
    const { data } = await user.api.repos.listForAuthenticatedUser({
      per_page: 100,
    });

    res.send(
      renderToStaticMarkup(
        <Layout>
          <div>
            <h4>Your repositories</h4>
            <ul>
              {data.map((repo: any) => (
                <li key={repo.id}>
                  <a href={`/app/repository/${repo.owner.login}/${repo.name}`}>
                    {repo.name}
                  </a>
                </li>
              ))}
            </ul>

            {data.length === 100 && (
              <div>We currently have a limit to 100 repositories</div>
            )}
          </div>
        </Layout>,
      ),
    );
  });

  router.get('/repository/:owner/:repository', async (req, res) => {
    const user = await getUser(req, res);
    if (!user) return;
    const { data } = await user.api.repos.get({
      owner: req.params.owner,
      repo: req.params.repository,
    });

    if (!data) {
      res.status(404).send(
        renderToStaticMarkup(
          <Layout>
            <div>repo not found</div>
          </Layout>,
        ),
      );
      return;
    }

    if (!data.permissions || !data.permissions.admin) {
      res.status(401).send(
        renderToStaticMarkup(
          <Layout>
            <div>
              not authorized to see this repo, you need to have admin permission
            </div>
          </Layout>,
        ),
      );
      return;
    }

    const { data: data2 } = await octokitApp.apps
      .getRepoInstallation({
        owner: req.params.owner,
        repo: req.params.repository,
      })
      .catch((err) => {
        return { status: err.status, data: undefined };
      });

    if (!data2) {
      res.send(
        renderToStaticMarkup(
          <Layout>
            <div>
              {process.env.REVIEWFLOW_NAME}{' '}
              {"isn't installed on this repo. Go to "}
              <a
                href={`https://github.com/apps/${process.env.REVIEWFLOW_NAME}/installations/new`}
              >
                Github Configuration
              </a>{' '}
              to add it.
            </div>
          </Layout>,
        ),
      );
      return;
    }

    res.send(
      renderToStaticMarkup(
        <Layout>
          <div>
            <h4>{req.params.repository}</h4>
          </div>
        </Layout>,
      ),
    );
  });
}
