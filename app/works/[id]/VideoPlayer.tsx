"use client";

import { useState } from "react";

type Props = {
  posterImage: string;
  movieUrl: string;
};

export default function VideoPlayer({ posterImage, movieUrl }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      {!isPlaying ? (
        <div
          onClick={() => setIsPlaying(true)}
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 9",
            background: "#000",
            cursor: "pointer",
            overflow: "hidden",
          }}
        >
          <img
            src={posterImage}
            alt="サンプル動画"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />

          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.25)",
            }}
          />

          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "90px",
              height: "90px",
              borderRadius: "9999px",
              border: "4px solid rgba(255,255,255,0.9)",
              background: "rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                borderTop: "18px solid transparent",
                borderBottom: "18px solid transparent",
                borderLeft: "28px solid white",
                marginLeft: "6px",
              }}
            />
          </div>
        </div>
      ) : (
        <iframe
          src={movieUrl}
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            border: "none",
            display: "block",
            background: "#000",
          }}
          allow="autoplay; fullscreen"
        />
      )}
    </div>
  );
}