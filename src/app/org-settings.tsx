import bodyParser from 'body-parser';
import type { Router } from 'express';
import type { ProbotOctokit } from 'probot';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { accountConfigs } from '../accountConfigs';
import type { MessageCategory } from '../dm/MessageCategory';
import { getUserDmSettings, updateCache } from '../dm/getUserDmSettings';
import { syncOrg } from '../events/account-handlers/actions/syncOrg';
import { syncTeamsAndTeamMembers } from '../events/account-handlers/actions/syncTeams';
import type { MongoStores } from '../mongo';
import Layout from '../views/Layout';
import { getUser } from './auth';

const dmMessages: Record<MessageCategory, string> = {
  'pr-lifecycle': 'Your PR is closed, merged, reopened',
  'pr-lifecycle-follow':
    "Someone closed, merged, reopened a PR you're reviewing",
  'pr-review': 'You are assigned to a review, someone reviewed your PR',
  'pr-review-follow': "Someone reviewed a PR you're also reviewing",
  'pr-comment': 'Someone commented on your PR',
  'pr-comment-bots': 'A bot commented on your PR',
  'pr-comment-follow': "Someone commented on a PR you're reviewing",
  'pr-comment-follow-bots': "A bot commented on a PR you're reviewing",
  'pr-comment-mention': 'Someone mentioned you in a PR',
  'pr-comment-thread': "Someone replied to a discussion you're in",
  'pr-merge-conflicts': 'Your PR has a merge conflict (not implemented)',
  'issue-comment-mention':
    'Someone mentioned you in an issue (not implemented)',
};

export default function orgSettings(
  router: Router,
  octokitApp: InstanceType<typeof ProbotOctokit>,
  mongoStores: MongoStores,
): void {
  router.get('/org/:org/force-sync', async (req, res) => {
    const user = await getUser(req, res);
    if (!user) return;

    const orgs = await user.api.orgs.listForAuthenticatedUser();
    const org = orgs.data.find((o) => o.login === req.params.org);
    if (!org) return res.redirect('/app');

    const o = await mongoStores.orgs.findByKey(org.id);
    if (!o) return res.redirect('/app');

    await syncOrg(mongoStores, user.api, o.installationId as number, org);
    await syncTeamsAndTeamMembers(mongoStores, user.api, org);

    res.redirect(`/app/org/${req.params.org}`);
  });

  router.get('/org/:org', async (req, res) => {
    const user = await getUser(req, res);
    if (!user) return;

    const orgs = await user.api.orgs.listForAuthenticatedUser();
    const org = orgs.data.find((o) => o.login === req.params.org);
    if (!org) return res.redirect('/app');

    const installation = await octokitApp.apps
      .getOrgInstallation({ org: org.login })
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

    const accountConfig = accountConfigs[org.login];
    const userDmSettings = await getUserDmSettings(
      mongoStores,
      org.login,
      org.id,
      user.authInfo.id,
    );

    res.send(
      renderToStaticMarkup(
        <Layout>
          <div>
            <h1>{process.env.REVIEWFLOW_NAME}</h1>
            <div style={{ display: 'flex' }}>
              <h2 style={{ flexGrow: 1 }}>{org.login}</h2>
              <a href="/app">Switch account</a>
            </div>

            <div style={{ display: 'flex' }}>
              <div style={{ flexGrow: 1 }}>
                <h4>Information</h4>
                {!accountConfig
                  ? 'Default config is used: https://github.com/christophehurpeau/reviewflow/blob/master/src/accountConfigs/defaultConfig.ts'
                  : `Custom config: https://github.com/christophehurpeau/reviewflow/blob/master/src/accountConfigs/${org.login}.ts`}
              </div>
              <div style={{ width: '380px' }}>
                <h4>My DM Settings</h4>
                {Object.entries(dmMessages).map(([key, name]) => (
                  <div key={key}>
                    <label htmlFor={key}>
                      <span
                        // eslint-disable-next-line react/no-danger
                        dangerouslySetInnerHTML={{
                          __html: `<input id="${key}" type="checkbox" autocomplete="off" ${
                            userDmSettings[key as MessageCategory]
                              ? 'checked="checked" '
                              : ''
                          }onclick="fetch(location.pathname, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: '${key}', value: event.currentTarget.checked }) })" />`,
                        }}
                      />
                      {name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Layout>,
      ),
    );
  });

  router.patch('/org/:org', bodyParser.json(), async (req, res) => {
    if (!req.body) {
      res.status(400).send('not ok');
      return;
    }

    const user = await getUser(req, res);
    if (!user) return;

    const orgs = await user.api.orgs.listForAuthenticatedUser();
    const org = orgs.data.find((o) => o.login === req.params.org);
    if (!org) return res.redirect('/app');

    (await mongoStores.userDmSettings.collection).updateOne(
      {
        _id: `${org.id}_${user.authInfo.id}`,
      },
      {
        $set: {
          [`settings.${req.body.key}`]: req.body.value,
          updated: new Date(),
        },
        $setOnInsert: {
          orgId: org.id,
          userId: user.authInfo.id,
          created: new Date(),
        },
      },
      { upsert: true },
    );

    const userDmSettingsConfig = await mongoStores.userDmSettings.findOne({
      orgId: org.id,
      userId: user.authInfo.id,
    });

    if (userDmSettingsConfig) {
      updateCache(org.login, user.authInfo.id, userDmSettingsConfig.settings);
    }

    res.send('ok');
  });
}
