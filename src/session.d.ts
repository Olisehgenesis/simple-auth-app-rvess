import "express-session";

type ProfileClaim = "name" | "preferred_username" | "picture";

declare module "express-session" {
  interface SessionData {
    user?: {
      sub: string;
      profile: Partial<Record<ProfileClaim, string>>;
    };
    authTransaction?: {
      state: string;
      nonce: string;
      codeVerifier: string;
    };
  }
}
