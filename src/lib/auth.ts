import "server-only";

import { Redis } from "@upstash/redis";
import * as oidc from "openid-client";

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
  codeVerifier: string;
}

const issuer = new URL("https://www.rvessid.org");
const sessionLifetimeSeconds = 8 * 60 * 60;
let oidcConfigPromise: Promise<oidc.Configuration> | undefined;
let redisClient: Redis | undefined;

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

export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      url: requiredEnv("KV_REST_API_URL"),
      token: requiredEnv("KV_REST_API_TOKEN"),
    });
  }
  return redisClient;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: sessionLifetimeSeconds,
  };
}

export async function saveTransaction(
  id: string,
  transaction: AuthTransaction,
): Promise<void> {
  await getRedis().set(`oidc:transaction:${id}`, transaction, {
    ex: 10 * 60,
  });
}

export async function takeTransaction(
  id: string,
): Promise<AuthTransaction | null> {
  return getRedis().getdel<AuthTransaction>(`oidc:transaction:${id}`);
}

export async function saveUserSession(
  id: string,
  user: AuthenticatedUser,
): Promise<void> {
  await getRedis().set(`oidc:session:${id}`, user, {
    ex: sessionLifetimeSeconds,
  });
}

export async function getUserSession(
  id: string | undefined,
): Promise<AuthenticatedUser | null> {
  if (!id) {
    return null;
  }
  return getRedis().get<AuthenticatedUser>(`oidc:session:${id}`);
}

export async function destroyUserSession(
  id: string | undefined,
): Promise<void> {
  if (id) {
    await getRedis().del(`oidc:session:${id}`);
  }
}

export async function createAuthorizationUrl(
  transaction: AuthTransaction,
): Promise<URL> {
  const config = await getOidcConfig();
  const challenge = await oidc.calculatePKCECodeChallenge(
    transaction.codeVerifier,
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
      pkceCodeVerifier: transaction.codeVerifier,
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
