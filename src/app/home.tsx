import type { Router } from 'express';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GitHubAPI } from 'probot/lib/github';
import type { MongoStores } from '../mongo';
import Layout from '../views/Layout';
import { getUser } from './auth';

export default function home(
  router: Router,
  api: GitHubAPI,
  mongoStores: MongoStores,
): void {
  router.get('/gh', async (req, res) => {
    const user = await getUser(req, res);
    if (!user) return;

    const orgs = await user.api.orgs.listForAuthenticatedUser();

    res.send(
      renderToStaticMarkup(
        <Layout>
          <div>
            <h1>{process.env.REVIEWFLOW_NAME}</h1>
            <div style={{ display: 'flex' }}>
              <div style={{ flexGrow: 1 }}>
                <h4>Choose your account</h4>
                <ul>
                  <li>
                    <a href="/app/user">{user.authInfo.login}</a>
                  </li>
                  {orgs.data.map((org) => (
                    <li key={org.id}>
                      <a href={`/app/org/${org.login}`}>{org.login}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Layout>,
      ),
    );
  });
}
