import { ResourcesServerError } from "liwi-resources-server";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";
import { requireAuthenticatedUser } from "./requireAuth.ts";

/** comma-separated github user ids; empty or unset: nobody is admin */
export const readAdminUserIds = (
  env: NodeJS.ProcessEnv = process.env,
): ReadonlySet<number> =>
  new Set(
    (env.REVIEWFLOW_ADMIN_USER_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => /^[1-9]\d*$/.test(id))
      .map(Number),
  );

export const isAdminUser = (
  adminUserIds: ReadonlySet<number>,
  user: { id: number } | undefined,
): boolean => !!user && adminUserIds.has(user.id);

export const requireAdmin = (
  adminUserIds: ReadonlySet<number>,
  loggedInUser: AuthenticatedWsUser | undefined,
): AuthenticatedWsUser => {
  const user = requireAuthenticatedUser(loggedInUser);
  if (!adminUserIds.has(user.id)) {
    throw new ResourcesServerError("FORBIDDEN", "Admin only");
  }
  return user;
};
