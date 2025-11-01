import type { Router } from "express";
import type { ProbotOctokit } from "probot";
import { renderToStaticMarkup } from "react-dom/server";
import { syncUser } from "../events/account-handlers/actions/syncUser.ts";
import type { MongoStores } from "../mongo.ts";
import Layout from "../views/Layout.tsx";
import { getUser } from "./auth.tsx";

export default function userSettings(
  router: Router,
  octokitApp: InstanceType<typeof ProbotOctokit>,
  mongoStores: MongoStores,
): void {
  router.get("/user/force-sync", async (req, res, next) => {
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
      if (!u?.installationId) {
        res.redirect("/app");
        return;
      }

      await syncUser(mongoStores, user.api, u.installationId, user.authInfo);

      res.redirect("/app/user");
    } catch (error) {
      next(error);
    }
  });

  router.get("/user", async (req, res, next) => {
    try {
      const user = await getUser(req, res);
      if (!user) return null;

      const { data: installation } = await octokitApp.rest.apps
        .getUserInstallation({
          username: user.authInfo.login,
        })
        .catch((error: unknown) => {
          return { status: (error as any).status, data: undefined };
        });

      if (!installation) {
        return res.send(
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
      }

      return res.send(
        renderToStaticMarkup(
          <Layout>
            <div>{process.env.REVIEWFLOW_NAME} is installed for this user</div>
          </Layout>,
        ),
      );
    } catch (error) {
      next(error);
      return null;
    }
  });
}
