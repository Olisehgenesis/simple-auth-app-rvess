import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserSession } from "../../lib/auth";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const cookieStore = await cookies();
  const user = await getUserSession(cookieStore.get("rvess.sid")?.value);
  if (!user) {
    redirect("/");
  }

  const claims = [
    ["Name", user.profile.name],
    ["Username", user.profile.preferred_username],
    ["Picture", user.profile.picture],
  ].filter((claim): claim is [string, string] => typeof claim[1] === "string");

  return (
    <section className="account">
      <div className="account-heading">
        <div className="status-mark status-mark-small" aria-hidden="true">
          <span />
        </div>
        <div>
          <p className="eyebrow">Authenticated with rvessID</p>
          <h1>Your account</h1>
        </div>
      </div>
      <dl className="claims">
        <div className="claim-row">
          <dt>Stable account ID (sub)</dt>
          <dd className="subject">{user.sub}</dd>
        </div>
        {claims.map(([label, value]) => (
          <div className="claim-row" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {claims.length === 0 && (
        <p className="empty-note">No optional profile details were returned.</p>
      )}
      <div className="account-actions">
        <a className="button button-secondary" href="/">
          Home
        </a>
        <form action="/api/auth/logout" method="post">
          <button className="button button-quiet" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </section>
  );
}
