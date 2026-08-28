import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <style>{`.advertisement { display: none; }`}</style>
      <h1>ページが見つかりません</h1>
      <p>お探しのページは存在しないか、移動した可能性があります。</p>
      <Link href="/">作品一覧へ戻る</Link>
    </main>
  );
}
