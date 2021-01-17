import cookieParser from 'cookie-parser';
import type { Probot, run } from 'probot';
import auth from './app/auth';
import home from './app/home';
import orgSettings from './app/org-settings';
import repository from './app/repository';
import userSettings from './app/user-settings';
import type { AppContext } from './context/AppContext';

export default async function appRouter(
  app: Probot,
  getRouter: Parameters<
    // eslint-disable-next-line @typescript-eslint/ban-types
    Extract<Parameters<typeof run>[0], Function>
  >[1]['getRouter'],
  { mongoStores }: AppContext,
): Promise<void> {
  const router = (getRouter as NonNullable<typeof getRouter>)('/app');
  const octokitApp = await app.auth();

  router.use(cookieParser());

  auth(router);
  repository(router, octokitApp);
  home(router, octokitApp, mongoStores);
  orgSettings(router, octokitApp, mongoStores);
  userSettings(router, octokitApp, mongoStores);
}
