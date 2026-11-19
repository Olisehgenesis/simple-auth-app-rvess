# Simple Auth App rvess

A small server-rendered demonstration of signing in with rvessID. It uses OpenID Connect Authorization Code flow with PKCE (S256), discovers provider endpoints from `https://www.rvessid.org/.well-known/openid-configuration`, and validates the ID token with the maintained `openid-client` library.

The app requests `openid profile` so it can display `name`, `preferred_username`, or `picture` when rvessID actually returns those claims. It does not request email, wallet, or verification claims, and it does not store access or ID tokens in the session.

## Register the app with rvessID

1. Sign in to rvessID and open the [developer dashboard](https://www.rvessid.org/developers).
2. Register an app named **Simple Auth App rvess**.
3. Add this exact development callback URL: `http://localhost:3000/auth/callback`.
4. Copy the client ID and client secret from the dashboard. The secret is shown once; keep both values on the server and never commit them.

Production callback URLs must use HTTPS. The callback URL in the dashboard must exactly match `OIDC_CALLBACK_URL`.

The live discovery document is authoritative for the issuer and protocol endpoints. The current docs page contains older `rvess.org` examples; this app uses the requested `www.rvessid.org` discovery URL and lets `openid-client` use the metadata it returns.

## Environment

Copy `.env.example` to `.env` and set:

| Variable | Description |
| --- | --- |
| `OIDC_CLIENT_ID` | Client ID from the rvessID developer dashboard |
| `OIDC_CLIENT_SECRET` | Client secret from the rvessID developer dashboard |
| `APP_ORIGIN` | Public origin of this app, such as `http://localhost:3000` |
| `OIDC_CALLBACK_URL` | Exact registered callback URL, such as `http://localhost:3000/auth/callback` |
| `SESSION_SECRET` | Random server-side session signing secret of at least 32 characters |
| `PORT` | Optional local listening port; defaults to `3000` |

Use your own randomly generated `SESSION_SECRET`; do not reuse the client secret. `.env` is excluded from Git.

## Run locally

```sh
npm install
cp .env.example .env
# Edit .env with your dashboard credentials and a random SESSION_SECRET.
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `npm run build` type-checks the app, and `npm start` starts it without the development watcher.

The client secret, sign-in state, nonce, PKCE verifier, and session data stay on the server. The session cookie is HTTP-only, SameSite=Lax, and Secure when the configured app origin uses HTTPS. This small example uses Express's in-memory session store and is intended for local demonstration, not production deployment; use a persistent server-side session store for a multi-process or production environment.

## Provider behavior

rvessID uses short-lived authorization codes and tokens, and does not issue email or refresh tokens. The app displays the stable `sub` from the validated ID token and only the allowlisted profile claims returned by the UserInfo endpoint. If none are returned, the account page says so rather than filling in mock values.
