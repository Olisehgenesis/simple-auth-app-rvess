import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simple Auth App rvess",
  description: "A small demonstration of signing in with rvessID.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a className="brand" href="/" aria-label="Simple Auth App rvess home">
            <span className="brand-mark" aria-hidden="true">
              <span />
              <span />
            </span>
            <span>
              Simple Auth App <strong>rvess</strong>
            </span>
          </a>
          <span className="provider-label">Sign in with rvessID</span>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          A small demonstration of OpenID Connect sign-in.
        </footer>
      </body>
    </html>
  );
}
