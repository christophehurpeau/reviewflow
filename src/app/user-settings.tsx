import type { Router } from 'express';
import type { ProbotOctokit } from 'probot';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { syncUser } from '../events/account-handlers/actions/syncUser';
import type { MongoStores } from '../mongo';
import Layout from '../views/Layout';
import { getUser } from './auth';

export default function userSettings(
  router: Router,
  octokitApp: InstanceType<typeof ProbotOctokit>,
  mongoStores: MongoStores,
): void {
  router.get(
    '/user/force-sync',
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (req, res, next) => {
      try {
        const user = await getUser(req, res);
        if (!user) return;

        // const { data: installation } = await api.apps
        //   .getUserInstallation({
        //     username: user.authInfo.login,
        //   })
        //   .catch((err) => {
        //     return { status: err.status, data: undefined };
        //   });

        // console.log(installation);

        const u = await mongoStores.users.findByKey(user.authInfo.id);
        if (!u || !u.installationId) {
          res.redirect('/app');
          return;
        }

        await syncUser(mongoStores, user.api, u.installationId!, user.authInfo);

        res.redirect('/app/user');
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/user',
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (req, res, next) => {
      try {
        const user = await getUser(req, res);
        if (!user) return;

        const { data: installation } = await octokitApp.apps
          .getUserInstallation({
            username: user.authInfo.login,
          })
          .catch((err) => {
            return { status: err.status, data: undefined };
          });

        if (!installation) {
          return res.send(
            renderToStaticMarkup(
              <Layout>
                <div>
                  {process.env.REVIEWFLOW_NAME}{' '}
                  {"isn't installed for this user. Go to "}
                  <a
                    href={`https://github.com/settings/apps/${process.env.REVIEWFLOW_NAME}/installations/new`}
                  >
                    Github Configuration
                  </a>{' '}
                  to install it.
                </div>
              </Layout>,
            ),
          );
        }

        return res.send(
          renderToStaticMarkup(
            <Layout>
              <div>
                {process.env.REVIEWFLOW_NAME} is installed for this user
              </div>
            </Layout>,
          ),
        );
      } catch (err) {
        next(err);
      }
    },
  );
}
