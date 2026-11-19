# Simple Auth App rvess

A small Next.js app demonstrating rvessID sign-in. It uses OpenID Connect Authorization Code flow with PKCE (S256), discovers provider endpoints from `https://www.rvessid.org/.well-known/openid-configuration`, and validates the ID token with the maintained `openid-client` library.

The app requests `openid profile` to display `name`, `preferred_username`, or `picture` only when rvessID returns them. It does not request email, wallet, or verification claims, and it does not store access or ID tokens in the session.

## Register the app with rvessID

1. Sign in to rvessID and open the [developer dashboard](https://www.rvessid.org/developers).
2. Register an app named **Simple Auth App rvess**.
3. Add the exact callback URL for the environment. For local development, use `http://localhost:3000/api/auth/callback`.
4. Copy the client ID and client secret from the dashboard. The secret is shown once; keep both values on the server and never commit them.

Production callback URLs must use HTTPS. The callback URL in the dashboard must exactly match `OIDC_CALLBACK_URL`.

The live discovery document is authoritative for the issuer and protocol endpoints. The `/docs` page contains older `rvess.org` examples; this app follows the requested `www.rvessid.org` discovery URL and uses the issuer returned by its metadata.

## Environment

Copy `.env.example` to `.env` and set:

| Variable | Description |
| --- | --- |
| `OIDC_CLIENT_ID` | Client ID from the rvessID developer dashboard |
| `OIDC_CLIENT_SECRET` | Client secret from the rvessID developer dashboard |
| `APP_ORIGIN` | Public origin of this app, such as `http://localhost:3000` |
| `OIDC_CALLBACK_URL` | Exact registered callback URL, such as `http://localhost:3000/api/auth/callback` |
| `SESSION_SECRET` | Random session encryption secret of at least 32 characters |

No database or Redis service is required. The app uses an encrypted, authenticated, HTTP-only session cookie for the short-lived authorization transaction and authenticated user profile. The PKCE verifier is derived on the server from the random transaction state and `SESSION_SECRET`; it is never sent to or stored in the browser. ID and access tokens are used only during callback validation and are not retained.

## Run locally

```sh
npm install
cp .env.example .env
# Edit .env with your rvessID credentials and a random SESSION_SECRET.
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `npm run build` creates the production build and `npm start` serves it locally.

## Vercel deployment

Import the GitHub repository into Vercel using the **Next.js** framework preset. Add the five environment variables above to the project. Set `APP_ORIGIN` to the deployment's canonical HTTPS origin and `OIDC_CALLBACK_URL` to `APP_ORIGIN` plus `/api/auth/callback`; register that exact callback in the rvessID developer dashboard. Redeploy after changing environment variables.

rvessID issues short-lived authorization codes and tokens, but no email or refresh tokens. The account page uses the validated ID token `sub` as the stable account ID and shows only allowlisted profile claims returned by the UserInfo endpoint.
