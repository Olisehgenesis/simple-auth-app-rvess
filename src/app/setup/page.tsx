import Link from "next/link";

export default function SetupPage() {
  return (
    <section className="intro">
      <p className="eyebrow">App configuration needed</p>
      <h1>Sign-in isn&apos;t set up yet.</h1>
      <p className="lede">
        Add the rvessID app credentials and a Redis REST connection to the
        deployment environment, then try again.
      </p>
      <Link className="button button-secondary" href="/">
        Return home
      </Link>
    </section>
  );
}
