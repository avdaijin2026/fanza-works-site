"use client";

import { useEffect, useState } from "react";

type Props = {
  images: string[];
};

export default function SampleGallery({ images }: Props) {
  const [filteredImages, setFilteredImages] = useState<string[]>([]);

  useEffect(() => {
    let isCancelled = false;

    async function checkImages() {
      const results = await Promise.all(
        images.map(
          (src) =>
            new Promise<string | null>((resolve) => {
              const img = new Image();

              img.onload = () => {
                const ratio = img.naturalHeight / img.naturalWidth;

                // 縦長を除外
                if (ratio > 1.2) {
                  resolve(null);
                } else {
                  resolve(src);
                }
              };

              img.onerror = () => {
                resolve(null);
              };

              img.src = src;
            })
        )
      );

      if (!isCancelled) {
        setFilteredImages(results.filter((src): src is string => src !== null));
      }
    }

    checkImages();

    return () => {
      isCancelled = true;
    };
  }, [images]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
        gap: "12px",
        marginTop: "20px",
      }}
    >
      {filteredImages.map((img) => (
        <div
          key={img}
          style={{
            background: "#111",
            padding: "4px",
          }}
        >
          <img
            src={img}
            style={{
              width: "100%",
              height: "180px",
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>
      ))}
    </div>
  );
}