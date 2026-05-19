"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HeaderSearchForm() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmed = keyword.trim();
    const query = new URLSearchParams();

    if (trimmed) {
      query.set("keyword", trimmed);
    }

    router.push(query.toString() ? `/?${query.toString()}` : "/");
    setKeyword("");
  };

  return (
    <form className="site-search" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="作品名・キーワードで検索"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />
      <button type="submit" aria-label="検索">
        🔍
      </button>
    </form>
  );
}