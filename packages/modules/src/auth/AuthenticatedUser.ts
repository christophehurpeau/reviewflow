export interface AuthenticatedUser {
  id: number;
  login: string;
}

/** `isAdmin` only drives what the webapp shows: the server checks it again */
export interface SessionUser extends AuthenticatedUser {
  isAdmin: boolean;
}
