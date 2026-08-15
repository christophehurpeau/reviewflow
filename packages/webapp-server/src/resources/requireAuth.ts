import { ResourcesServerError } from "liwi-resources-server";
import type { MongoStores, OrgMember } from "reviewflow-core";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";

export const requireAuthenticatedUser = (
  loggedInUser: AuthenticatedWsUser | undefined,
): AuthenticatedWsUser => {
  if (!loggedInUser) {
    throw new ResourcesServerError("UNAUTHENTICATED", "Not authenticated");
  }
  return loggedInUser;
};

/**
 * Nothing about an org may be read without proving membership: the client only
 * ever sends an org id, and mongo has no other tenant boundary.
 */
export const requireOrgMember = async (
  mongoStores: MongoStores,
  orgId: number,
  loggedInUser: AuthenticatedWsUser | undefined,
): Promise<{ user: AuthenticatedWsUser; orgMember: OrgMember }> => {
  const user = requireAuthenticatedUser(loggedInUser);
  const orgMember = await mongoStores.orgMembers.findOne({
    "org.id": orgId,
    "user.id": user.id,
  });

  if (!orgMember) {
    throw new ResourcesServerError(
      "FORBIDDEN",
      "You are not a member of this organization",
    );
  }

  return { user, orgMember };
};

/**
 * `orgId: null` spans every org the user belongs to. Memberships stay the only
 * thing bounding the query, so an unscoped read can never widen past them.
 */
export const requireOrgMembers = async (
  mongoStores: MongoStores,
  orgId: number | null,
  loggedInUser: AuthenticatedWsUser | undefined,
): Promise<{ user: AuthenticatedWsUser; orgMembers: OrgMember[] }> => {
  if (orgId !== null) {
    const { user, orgMember } = await requireOrgMember(
      mongoStores,
      orgId,
      loggedInUser,
    );
    return { user, orgMembers: [orgMember] };
  }

  const user = requireAuthenticatedUser(loggedInUser);
  const orgMembers = await mongoStores.orgMembers.findAll({
    "user.id": user.id,
  });

  return { user, orgMembers };
};
