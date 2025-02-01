import cookieParser from "cookie-parser";
import type { Probot, run } from "probot";
import auth from "./app/auth.tsx";
import home from "./app/home.tsx";
import orgSettings from "./app/org-settings.tsx";
import repository from "./app/repository.tsx";
import slackConnect from "./app/slack-connect.tsx";
import userSettings from "./app/user-settings.tsx";
import type { AppContext } from "./context/AppContext";

export default async function appRouter(
  app: Probot,
  getRouter: Parameters<
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    Extract<Parameters<typeof run>[0], Function>
  >[1]["getRouter"],
  { mongoStores }: AppContext,
): Promise<void> {
  const router = getRouter!("/app");
  const octokitApp = await app.auth();

  router.use(cookieParser());

  auth(router);
  repository(router, octokitApp);
  home(router, octokitApp, mongoStores);
  orgSettings(router, octokitApp, mongoStores);
  userSettings(router, octokitApp, mongoStores);
  slackConnect(router, mongoStores);
}
