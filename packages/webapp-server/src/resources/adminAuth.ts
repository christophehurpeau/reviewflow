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

/**
 * Never through the editor extension: its token sits on the developer's disk
 * for days, and the admin switches paid features for every account.
 */
export const isAdminUser = (
  adminUserIds: ReadonlySet<number>,
  user: Pick<AuthenticatedWsUser, "id" | "isEditorSession"> | undefined,
): boolean => !!user && !user.isEditorSession && adminUserIds.has(user.id);

export const requireAdmin = (
  adminUserIds: ReadonlySet<number>,
  loggedInUser: AuthenticatedWsUser | undefined,
): AuthenticatedWsUser => {
  const user = requireAuthenticatedUser(loggedInUser);
  if (!isAdminUser(adminUserIds, user)) {
    throw new ResourcesServerError("FORBIDDEN", "Admin only");
  }
  return user;
};
