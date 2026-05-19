import Link from "next/link";
import "./globals.css";
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
              <Link href="/series">シリーズ</Link>
              <Link href="/makers">メーカー</Link>
              <Link href="/labels">レーベル</Link>
            </nav>
          </div>
        </header>

        <main>{children}</main>
      </body>
    </html>
  );
}