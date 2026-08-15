export interface BasicUser {
  id: number;
  login: string;
  type?: string | "Bot" | "User";
  avatar_url?: string;
}
