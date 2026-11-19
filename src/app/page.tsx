import Link from "next/link";
import { getAppSession } from "../lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getAppSession();
  const user = session.user;

  if (user) {
    return (
      <section className="intro">
        <div className="status-mark" aria-hidden="true">
          <span />
        </div>
        <p className="eyebrow">Your rvessID session</p>
        <h1>You&apos;re signed in.</h1>
        <p className="lede">
          Your account is connected. View the stable identifier and profile
          details rvessID returned.
        </p>
        <Link className="button button-primary" href="/account">
          View your account
        </Link>
        <form className="signout-form" action="/api/auth/logout" method="post">
          <button className="button button-quiet" type="submit">
            Sign out
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="intro">
      <div className="status-mark" aria-hidden="true">
        <span />
      </div>
      <p className="eyebrow">A simple identity demonstration</p>
      <h1>
        Your identity,
        <br />
        verified by rvessID.
      </h1>
      <p className="lede">
        Sign in to see the stable account ID and profile details the provider
        shares with this app.
      </p>
      <a className="button button-primary" href="/api/auth/login">
        Continue with rvessID
      </a>
      <p className="privacy-note">
        This app requests your basic profile only. It does not request email or
        retain access tokens.
      </p>
    </section>
  );
}
