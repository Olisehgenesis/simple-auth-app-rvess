import "server-only";

import { createHmac } from "node:crypto";
import { getIronSession, type SessionOptions } from "iron-session";
import * as oidc from "openid-client";
import { cookies } from "next/headers";

export type Profile = Partial<
  Record<"name" | "preferred_username" | "picture", string>
>;

export interface AuthenticatedUser {
  sub: string;
  profile: Profile;
}

export interface AuthTransaction {
  state: string;
  nonce: string;
}

export interface AppSession {
  authTransaction?: AuthTransaction;
  user?: AuthenticatedUser;
}

const issuer = new URL("https://www.rvessid.org");
const sessionLifetimeSeconds = 8 * 60 * 60;
let oidcConfigPromise: Promise<oidc.Configuration> | undefined;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getClientId(): string {
  return requiredEnv("OIDC_CLIENT_ID");
}

export function getClientSecret(): string {
  return requiredEnv("OIDC_CLIENT_SECRET");
}

export function getCallbackUrl(): string {
  const callback = new URL(requiredEnv("OIDC_CALLBACK_URL"));
  const origin = new URL(requiredEnv("APP_ORIGIN"));
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    callback.origin !== origin.origin ||
    callback.search ||
    callback.hash ||
    (process.env.NODE_ENV === "production" && origin.protocol !== "https:")
  ) {
    throw new Error(
      "OIDC_CALLBACK_URL must be a path on APP_ORIGIN without a query or fragment.",
    );
  }
  return callback.href;
}

export function getOidcConfig(): Promise<oidc.Configuration> {
  oidcConfigPromise ??= oidc.discovery(
    issuer,
    getClientId(),
    getClientSecret(),
    oidc.ClientSecretBasic(getClientSecret()),
  );
  return oidcConfigPromise;
}

export function getSessionOptions(): SessionOptions {
  return {
    cookieName: "rvess.sid",
    password: requiredEnv("SESSION_SECRET"),
    ttl: sessionLifetimeSeconds,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: sessionLifetimeSeconds,
    },
  };
}

export async function getAppSession() {
  return getIronSession<AppSession>(await cookies(), getSessionOptions());
}

export function createCodeVerifier(state: string): string {
  return createHmac("sha256", requiredEnv("SESSION_SECRET"))
    .update(`rvessid-pkce:${state}`)
    .digest("base64url");
}

export async function createAuthorizationUrl(
  transaction: AuthTransaction,
): Promise<URL> {
  const config = await getOidcConfig();
  const challenge = await oidc.calculatePKCECodeChallenge(
    createCodeVerifier(transaction.state),
  );

  return oidc.buildAuthorizationUrl(config, {
    client_id: getClientId(),
    redirect_uri: getCallbackUrl(),
    response_type: "code",
    scope: "openid profile",
    state: transaction.state,
    nonce: transaction.nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
}

export async function redeemAuthorizationCode(
  callbackUrl: URL,
  transaction: AuthTransaction,
): Promise<AuthenticatedUser> {
  const config = await getOidcConfig();
  const tokens = await oidc.authorizationCodeGrant(
    config,
    callbackUrl,
    {
      expectedState: transaction.state,
      expectedNonce: transaction.nonce,
      pkceCodeVerifier: createCodeVerifier(transaction.state),
    },
    { redirect_uri: getCallbackUrl() },
  );
  const idTokenClaims = tokens.claims();
  if (
    !idTokenClaims ||
    typeof idTokenClaims.sub !== "string" ||
    !tokens.access_token
  ) {
    throw new Error("The validated sign-in response was incomplete.");
  }

  const userInfo = await oidc.fetchUserInfo(
    config,
    tokens.access_token,
    idTokenClaims.sub,
  );
  const profile: Profile = {};
  for (const claim of ["name", "preferred_username", "picture"] as const) {
    if (typeof userInfo[claim] === "string") {
      profile[claim] = userInfo[claim];
    }
  }

  return { sub: idTokenClaims.sub, profile };
}

export { oidc, sessionLifetimeSeconds };
