interface CheckIsMissingRestrictedApprobationOptions {
  restrictAutoMergeTo: string[] | undefined;
  authorLogin: string | undefined;
  approvedLogins: string[];
}

// a restricted approver cannot approve their own pull request, opening it is their approbation
export const checkIsMissingRestrictedApprobation = ({
  restrictAutoMergeTo,
  authorLogin,
  approvedLogins,
}: CheckIsMissingRestrictedApprobationOptions): boolean => {
  if (!restrictAutoMergeTo) return false;
  if (authorLogin && restrictAutoMergeTo.includes(authorLogin)) return false;
  return !approvedLogins.some((login) => restrictAutoMergeTo.includes(login));
};

interface GetRestrictedReviewersToRequestOptions {
  restrictAutoMergeTo: string[] | undefined;
  authorLogin: string | undefined;
  requestedReviewerLogins: string[];
}

export const getRestrictedReviewersToRequest = ({
  restrictAutoMergeTo,
  authorLogin,
  requestedReviewerLogins,
}: GetRestrictedReviewersToRequestOptions): string[] => {
  if (!restrictAutoMergeTo) return [];
  return restrictAutoMergeTo.filter(
    (login) =>
      login !== authorLogin && !requestedReviewerLogins.includes(login),
  );
};
