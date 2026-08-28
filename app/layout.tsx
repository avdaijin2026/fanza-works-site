import Link from "next/link";
import "./globals.css";
import Script from "next/script";
import HeaderSearchForm from "../components/HeaderSearchForm";

export const metadata = {
  title: "AV大臣",
  description: "FANZA APIを使った作品一覧サイト",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
      {/* Google Tag Manager */}
        <Script id="gtm-script" strategy="afterInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-5779WVMC');
          `}
        </Script>

        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-5779WVMC"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <header className="site-header">
          <div className="site-header-inner">
            <div className="site-header-top">
              <div className="site-logo">
                <Link href="/">AV大臣</Link>
              </div>

              <HeaderSearchForm />
            </div>

            <nav className="site-nav">
              <Link href="/">Home</Link>
              <Link href="/genres">ジャンル</Link>
              <Link href="/actresses">AV女優</Link>
              <Link href="/rankings/actresses">人気女優</Link>
              <Link href="/series">シリーズ</Link>
              <Link href="/makers">メーカー</Link>
              <Link href="/labels">レーベル</Link>
            </nav>
          </div>
        </header>

        {children}
        <footer
          style={{
            marginTop: "3rem",
            padding: "1.5rem 1rem",
            borderTop: "1px solid rgba(255, 255, 255, 0.12)",
            color: "#9ca3af",
            fontSize: "0.875rem",
            textAlign: "center",
          }}
        >
          Powered by{" "}
          <a
            href="https://affiliate.dmm.com/api/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "inherit" }}
          >
            FANZA Webサービス
          </a>
        </footer>
      </body>
    </html>
  );
}
