import "dotenv/config";

import express, { type Request, type Response } from "express";
import session from "express-session";
import * as oidc from "openid-client";
import { fileURLToPath } from "node:url";

const issuer = new URL("https://www.rvessid.org");
const clientId = requiredEnv("OIDC_CLIENT_ID");
const clientSecret = requiredEnv("OIDC_CLIENT_SECRET");
const appOrigin = new URL(requiredEnv("APP_ORIGIN"));
const callbackUrl = new URL(requiredEnv("OIDC_CALLBACK_URL"));
const sessionSecret = requiredEnv("SESSION_SECRET");
const port = Number(process.env.PORT ?? "3000");

if (!["http:", "https:"].includes(appOrigin.protocol) || appOrigin.origin !== appOrigin.href.replace(/\/$/, "")) {
  throw new Error("APP_ORIGIN must be an origin such as http://localhost:3000.");
}
if (callbackUrl.origin !== appOrigin.origin || callbackUrl.search || callbackUrl.hash) {
  throw new Error("OIDC_CALLBACK_URL must be a path on APP_ORIGIN without a query or fragment.");
}
if (sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET must contain at least 32 characters.");
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port.");
}

const app = express();
const secureCookie = appOrigin.protocol === "https:";
let oidcConfigPromise: Promise<oidc.Configuration> | undefined;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getOidcConfig(): Promise<oidc.Configuration> {
  oidcConfigPromise ??= oidc.discovery(
    issuer,
    clientId,
    clientSecret,
    oidc.ClientSecretBasic(clientSecret),
  );
  return oidcConfigPromise;
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character]!;
  });
}

function page(title: string, content: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#f1f7f5">
    <title>${escapeHtml(title)} · Simple Auth App rvess</title>
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body>
    <header class="site-header">
      <a class="brand" href="/" aria-label="Simple Auth App rvess home">
        <span class="brand-mark" aria-hidden="true"><span></span><span></span></span>
        <span>Simple Auth App <strong>rvess</strong></span>
      </a>
      <span class="provider-label">Sign in with rvessID</span>
    </header>
    <main>${content}</main>
    <footer class="site-footer">A small demonstration of OpenID Connect sign-in.</footer>
  </body>
</html>`;
}

function renderHome(res: Response, user?: Request["session"]["user"]): void {
  if (user) {
    res.send(
      page(
        "Signed in",
        `<section class="intro">
          <div class="status-mark" aria-hidden="true"><span></span></div>
          <p class="eyebrow">Your rvessID session</p>
          <h1>You're signed in.</h1>
          <p class="lede">Your account is connected. View the stable identifier and profile details rvessID returned.</p>
          <a class="button button-primary" href="/account">View your account</a>
          <form class="signout-form" action="/auth/logout" method="post">
            <button class="button button-quiet" type="submit">Sign out</button>
          </form>
        </section>`,
      ),
    );
    return;
  }

  res.send(
    page(
      "Sign in",
      `<section class="intro">
        <div class="status-mark" aria-hidden="true"><span></span></div>
        <p class="eyebrow">A simple identity demonstration</p>
        <h1>Your identity,<br>verified by rvessID.</h1>
        <p class="lede">Sign in to see the stable account ID and profile details the provider shares with this app.</p>
        <a class="button button-primary" href="/auth/login">Continue with rvessID</a>
        <p class="privacy-note">This app requests your basic profile only. It does not request email or retain access tokens.</p>
      </section>`,
    ),
  );
}

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; style-src 'self'; img-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
  );
  if (secureCookie) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  }
  next();
});
app.use(
  session({
    name: "rvess.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
      maxAge: 8 * 60 * 60 * 1000,
    },
  }),
);
app.use(express.static(fileURLToPath(new URL("../public", import.meta.url))));

app.get("/", (req, res) => renderHome(res, req.session.user));

app.get("/auth/login", async (req, res) => {
  try {
    await regenerateSession(req);
    const config = await getOidcConfig();
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

    req.session.authTransaction = { state, nonce, codeVerifier };
    await saveSession(req);

    const authorizationUrl = oidc.buildAuthorizationUrl(config, {
      client_id: clientId,
      redirect_uri: callbackUrl.href,
      response_type: "code",
      scope: "openid profile",
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    res.redirect(authorizationUrl.href);
  } catch {
    console.error("OIDC authorization setup failed.");
    res.status(503).send(page("Sign-in unavailable", errorContent("Sign-in is temporarily unavailable. Check the server configuration and try again.")));
  }
});

app.get("/auth/callback", async (req, res) => {
  const transaction = req.session.authTransaction;
  const state = req.query.state;
  const code = req.query.code;
  const error = req.query.error;

  if (!transaction || typeof state !== "string" || state !== transaction.state) {
    res.status(400).send(page("Sign-in failed", errorContent("The sign-in response could not be verified. Start again from this app.")));
    return;
  }

  if (typeof error === "string") {
    delete req.session.authTransaction;
    await saveSession(req);
    res.status(400).send(page("Sign-in not completed", errorContent("Sign-in was not completed. You can try again from this app.")));
    return;
  }

  if (typeof code !== "string") {
    res.status(400).send(page("Sign-in failed", errorContent("The sign-in response was incomplete. Start again from this app.")));
    return;
  }

  try {
    delete req.session.authTransaction;
    await saveSession(req);

    const responseUrl = new URL(callbackUrl);
    responseUrl.search = new URL(req.originalUrl, appOrigin).search;
    const config = await getOidcConfig();
    const tokens = await oidc.authorizationCodeGrant(config, responseUrl, {
      expectedState: transaction.state,
      expectedNonce: transaction.nonce,
      pkceCodeVerifier: transaction.codeVerifier,
    });
    const idTokenClaims = tokens.claims();

    if (!idTokenClaims || typeof idTokenClaims.sub !== "string" || !tokens.access_token) {
      throw new Error("The validated sign-in response was incomplete.");
    }

    const userInfo = await oidc.fetchUserInfo(config, tokens.access_token, idTokenClaims.sub);
    const profile: Partial<Record<"name" | "preferred_username" | "picture", string>> = {};
    for (const claim of ["name", "preferred_username", "picture"] as const) {
      if (typeof userInfo[claim] === "string") {
        profile[claim] = userInfo[claim];
      }
    }

    await regenerateSession(req);
    req.session.user = { sub: idTokenClaims.sub, profile };
    await saveSession(req);
    res.redirect("/account");
  } catch {
    console.error("OIDC callback validation failed.");
    res.status(400).send(page("Sign-in failed", errorContent("rvessID could not verify this sign-in. Please start again.")));
  }
});

app.get("/account", (req, res) => {
  const user = req.session.user;
  if (!user) {
    res.redirect("/");
    return;
  }

  const claims = [
    ["Name", user.profile.name],
    ["Username", user.profile.preferred_username],
    ["Picture", user.profile.picture],
  ].filter((claim): claim is [string, string] => typeof claim[1] === "string");
  const profileRows = claims.length
    ? claims
        .map(([label, value]) => `<div class="claim-row"><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`)
        .join("")
    : `<p class="empty-note">No optional profile details were returned.</p>`;

  res.send(
    page(
      "Your account",
      `<section class="account">
        <div class="account-heading">
          <div class="status-mark status-mark-small" aria-hidden="true"><span></span></div>
          <div>
            <p class="eyebrow">Authenticated with rvessID</p>
            <h1>Your account</h1>
          </div>
        </div>
        <dl class="claims">
          <div class="claim-row">
            <dt>Stable account ID (sub)</dt>
            <dd class="subject">${escapeHtml(user.sub)}</dd>
          </div>
          ${profileRows}
        </dl>
        <div class="account-actions">
          <a class="button button-secondary" href="/">Home</a>
          <form action="/auth/logout" method="post">
            <button class="button button-quiet" type="submit">Sign out</button>
          </form>
        </div>
      </section>`,
    ),
  );
});

app.post("/auth/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Session sign-out failed.");
      res.status(500).send(page("Sign-out failed", errorContent("Your session could not be cleared. Please try again.")));
      return;
    }
    res.clearCookie("rvess.sid", { path: "/" });
    res.redirect("/");
  });
});

app.use((_req, res) => {
  res.status(404).send(page("Not found", errorContent("This page does not exist.")));
});

function errorContent(message: string): string {
  return `<section class="intro">
    <p class="eyebrow">Something went wrong</p>
    <h1>Sign-in unavailable.</h1>
    <p class="lede">${escapeHtml(message)}</p>
    <a class="button button-secondary" href="/">Return home</a>
  </section>`;
}

app.listen(port, () => {
  console.log(`Simple Auth App rvess is listening on ${appOrigin.origin}`);
});
