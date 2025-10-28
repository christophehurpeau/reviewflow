import bodyParser from "body-parser";
import type { Router } from "express";
import type { ProbotOctokit } from "probot";
import { renderToStaticMarkup } from "react-dom/server";
import { accountConfigs, defaultConfig } from "../accountConfigs/index.ts";
import { getTeams } from "../context/accountContext.ts";
import type { MessageCategory } from "../dm/MessageCategory.ts";
import { getUserDmSettings, updateCache } from "../dm/getUserDmSettings.ts";
import { syncOrg } from "../events/account-handlers/actions/syncOrg.ts";
import { syncTeamsAndTeamMembers } from "../events/account-handlers/actions/syncTeams.ts";
import type { MongoStores } from "../mongo.ts";
import Layout from "../views/Layout.tsx";
import { getUser } from "./auth.tsx";

const dmMessages: Record<MessageCategory, string> = {
  "pr-checksAndStatuses": "Your PR has failed checks or statuses",
  "pr-lifecycle": "Your PR is closed, merged, reopened",
  "pr-lifecycle-follow":
    "Someone closed, merged, reopened a PR you're reviewing",
  "pr-review": "You are assigned to a review, someone reviewed your PR",
  "pr-review-follow": "Someone reviewed a PR you're also reviewing",
  "pr-comment": "Someone commented on your PR",
  "pr-comment-bots": "A bot commented on your PR",
  "pr-comment-follow": "Someone commented on a PR you're reviewing",
  "pr-comment-follow-bots": "A bot commented on a PR you're reviewing",
  "pr-comment-mention": "Someone mentioned you in a PR",
  "pr-comment-thread": "Someone replied to a discussion you're in",
  "pr-merge-conflicts": "Your PR has a merge conflict (not implemented)",
  "commit-comment": "Someone commented on your commit",
  "commit-comment-bots": "A bot commented on your commit",
  "commit-comment-follow": "Someone commented on a commit you also commented",
  "commit-comment-follow-bots":
    "A bot commented on a commit you also commented",
  "commit-comment-mention": "Someone mentioned you in a commit comment",
  "issue-comment-mention":
    "Someone mentioned you in an issue (not implemented)",
};

export default function orgSettings(
  router: Router,
  octokitApp: InstanceType<typeof ProbotOctokit>,
  mongoStores: MongoStores,
): void {
  router.get("/org/:org/force-sync", async (req, res, next) => {
    try {
      const user = await getUser(req, res);
      if (!user) return;

      const orgs = await user.api.orgs.listForAuthenticatedUser();
      const org = orgs.data.find((o) => o.login === req.params.org);
      if (!org) {
        res.redirect("/app");
        return;
      }

      const o = await mongoStores.orgs.findByKey(org.id);
      if (!o) {
        res.redirect("/app");
        return;
      }

      await syncOrg(mongoStores, user.api, o.installationId, org);
      await syncTeamsAndTeamMembers(mongoStores, user.api, org);

      res.redirect(`/app/org/${req.params.org}`);
    } catch (error) {
      next(error);
    }
  });

  router.get("/org/:org", async (req, res, next): Promise<void> => {
    const user = await getUser(req, res);
    try {
      if (!user) return;

      const authenticatedUserOrgs =
        await user.api.orgs.listForAuthenticatedUser();
      const org = authenticatedUserOrgs.data.find(
        (o) => o.login === req.params.org,
      );
      if (!org) {
        res.redirect("/app");
        return;
      }

      const [installation, orgInDb] = await Promise.all([
        octokitApp.apps
          .getOrgInstallation({ org: org.login })
          .catch((error: unknown) => {
            return { status: (error as any).status, data: undefined };
          }),
        mongoStores.orgs.findByKey(org.id),
      ]);

      if (!orgInDb) {
        res.send(
          renderToStaticMarkup(
            <Layout>
              <div>
                {process.env.REVIEWFLOW_NAME}
                {" isn't correctly installed. Contact support."}
              </div>
            </Layout>,
          ),
        );
        return;
      }

      const slackTeam = orgInDb.slackTeamId
        ? await mongoStores.slackTeams.findByKey(orgInDb.slackTeamId)
        : undefined;

      if (!installation) {
        res.send(
          renderToStaticMarkup(
            <Layout>
              <div>
                {process.env.REVIEWFLOW_NAME}{" "}
                {"isn't installed for this user. Go to "}
                <a
                  href={`https://github.com/settings/apps/${process.env.REVIEWFLOW_NAME}/installations/new`}
                >
                  Github Configuration
                </a>{" "}
                to install it.
              </div>
            </Layout>,
          ),
        );
        return;
      }

      const accountConfig = accountConfigs[org.login];
      const accountOrDefaultConfig = accountConfig || defaultConfig;
      const [orgMember, userDmSettings] = await Promise.all([
        mongoStores.orgMembers.findOne({
          "org.id": org.id,
          "user.id": user.authInfo.id,
        }),
        getUserDmSettings(mongoStores, org.login, org.id, user.authInfo.id),
      ]);
      const teams = orgMember
        ? getTeams(accountOrDefaultConfig, orgMember)
        : [];

      res.send(
        renderToStaticMarkup(
          <Layout>
            <div>
              <div style={{ display: "flex" }}>
                <h2 style={{ flexGrow: 1 }}>{org.login}</h2>
                <a href="/app">Switch account</a>
              </div>

              <div style={{ display: "flex" }}>
                <div style={{ flexGrow: 1 }}>
                  <h4>Account Config</h4>
                  {!accountConfig
                    ? "Default config is used: https://github.com/christophehurpeau/reviewflow/blob/master/src/accountConfigs/defaultConfig.ts"
                    : `Custom config: https://github.com/christophehurpeau/reviewflow/blob/master/src/accountConfigs/${org.login}.ts`}

                  <h4 style={{ marginTop: "1rem" }}>Slack Connection</h4>
                  {(() => {
                    if (!slackTeam && !orgInDb.slackToken) {
                      return (
                        <>
                          Slack account yet linked ! Install application to get
                          notifications for your reviews.
                          <br />
                          <a
                            href={`/app/slack-install?orgId=${encodeURIComponent(
                              org.id,
                            )}&orgLogin=${encodeURIComponent(org.login)}`}
                          >
                            <img
                              alt="Add to Slack"
                              height="40"
                              width="139"
                              src="https://platform.slack-edge.com/img/add_to_slack.png"
                              srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x"
                            />
                          </a>
                        </>
                      );
                    }
                    if (!orgMember?.slack) {
                      return (
                        <>
                          <div>Slack Team: {slackTeam?.teamName}</div>
                          Slack account yet linked ! Sign in to get
                          notifications for your reviews.
                          <br />
                          <a
                            href={`/app/slack-connect?orgId=${encodeURIComponent(
                              org.id,
                            )}&orgLogin=${encodeURIComponent(org.login)}`}
                          >
                            <img
                              src="https://api.slack.com/img/sign_in_with_slack.png"
                              alt="Sign in with Slack"
                            />
                          </a>
                        </>
                      );
                    }
                    return (
                      <div>
                        {!orgInDb.slackToken
                          ? null
                          : "⚠ This account use a custom slack application."}
                        <div>
                          Slack Team: {slackTeam?.teamName} (
                          {orgMember.slack.teamId || slackTeam?._id})
                        </div>
                        <div>Slack User ID: {orgMember.slack.id}</div>
                      </div>
                    );
                  })()}
                  <h4 style={{ marginTop: "1rem" }}>User Information</h4>
                  {!orgMember ? (
                    <>User not found in database</>
                  ) : (
                    <>
                      <div>Team Names: {teams.join(", ") || "No teams"}</div>
                      <div>
                        Github Teams:{" "}
                        {orgMember.teams
                          .map((githubTeam) => githubTeam.name)
                          .join(", ") || "No teams"}
                      </div>
                    </>
                  )}
                </div>
                <div style={{ width: "380px" }}>
                  <h4>My DM Settings</h4>
                  {!orgMember?.slack ? (
                    <>Link your github account to unlock DM Settings</>
                  ) : (
                    <>
                      {Object.entries(dmMessages).map(([key, name]) => (
                        <div key={key}>
                          <label htmlFor={key}>
                            <span
                              dangerouslySetInnerHTML={{
                                __html: `<input id="${key}" type="checkbox" autocomplete="off" ${
                                  userDmSettings.settings[
                                    key as MessageCategory
                                  ]
                                    ? 'checked="checked" '
                                    : ""
                                }onclick="fetch(location.pathname, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: '${key}', value: event.currentTarget.checked }) })" />`,
                              }}
                            />
                            {name}
                          </label>
                        </div>
                      ))}

                      {orgMember.teams.length === 0 ? null : (
                        <>
                          <h4 style={{ marginTop: "20px" }}>
                            My DM settings - Github Teams
                          </h4>
                          <i>
                            Untick to disable notifications for teams you belong
                            to.
                          </i>

                          {orgMember.teams.map((team) => (
                            <div key={team.id}>
                              <label htmlFor={`team_${team.id}`}>
                                <span
                                  dangerouslySetInnerHTML={{
                                    __html: `<input id="team_${
                                      team.id
                                    }" type="checkbox" autocomplete="off" ${
                                      !userDmSettings.silentTeams?.some(
                                        (t) => t.id === team.id,
                                      )
                                        ? 'checked="checked" '
                                        : ""
                                    }onclick="fetch(location.pathname, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ silentTeam: ${JSON.stringify(
                                      team,
                                    )
                                      .replace(/'/g, "\\'")
                                      // TODO " in name is replaced by '. Acceptable because not used, but should be fixed.
                                      .replace(
                                        /"/g,
                                        "'",
                                      )}, value: !event.currentTarget.checked }) })" />`,
                                  }}
                                />
                                {team.name}
                              </label>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </Layout>,
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.patch("/org/:org", bodyParser.json(), async (req, res, next) => {
    try {
      if (!req.body) {
        res.status(400).send("not ok");
        return;
      }
      if (!req.body.key && !req.body.silentTeam) {
        res.status(400).send("not ok");
        return;
      }

      const user = await getUser(req, res);
      if (!user) return;

      const orgs = await user.api.orgs.listForAuthenticatedUser();
      const org = orgs.data.find((o) => o.login === req.params.org);
      if (!org) {
        res.redirect("/app");
        return;
      }
      const $setOnInsert = {
        orgId: org.id,
        userId: user.authInfo.id,
        created: new Date(),
      };

      const userDmSettingsCollection =
        await mongoStores.userDmSettings.collection;
      await userDmSettingsCollection.updateOne(
        {
          _id: `${org.id}_${user.authInfo.id}`,
        },
        req.body.key
          ? {
              $set: {
                [`settings.${req.body.key}`]: req.body.value,
                updated: new Date(),
              },
              $setOnInsert,
            }
          : {
              [req.body.value ? "$push" : "$pull"]: {
                silentTeams: req.body.value
                  ? req.body.silentTeam
                  : { id: req.body.silentTeam.id },
              },
              $setOnInsert,
            },
        { upsert: true },
      );

      const userDmSettingsConfig = await mongoStores.userDmSettings.findOne({
        orgId: org.id,
        userId: user.authInfo.id,
      });

      if (userDmSettingsConfig) {
        updateCache(org.login, user.authInfo.id, userDmSettingsConfig);
      }

      res.send("ok");
    } catch (error) {
      next(error);
    }
  });
}
