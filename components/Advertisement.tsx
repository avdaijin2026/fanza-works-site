"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type AdvertisementPosition = "top" | "bottom";

type AdvertisementProps = {
  position: AdvertisementPosition;
};

const advertisementIds: Record<AdvertisementPosition, string> = {
  top: "1275",
  bottom: "1276",
};

export default function Advertisement({ position }: AdvertisementProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [visiblePathname, setVisiblePathname] = useState<string | null>(null);
  const pathname = usePathname();
  const id = advertisementIds[position];

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateVisibility = () => {
      const isNotFound = document.querySelector(
        '[data-page-not-found="true"]'
      );

      setIsMobile(mediaQuery.matches && !isNotFound);
      setVisiblePathname(pathname);
    };

    updateVisibility();
    mediaQuery.addEventListener("change", updateVisibility);

    return () => {
      mediaQuery.removeEventListener("change", updateVisibility);
    };
  }, [pathname]);

  if (!isMobile || visiblePathname !== pathname) {
    return null;
  }

  return (
    <aside
      className={`advertisement advertisement-${position}`}
      aria-label="広告"
      data-ad-id={id}
    >
      <span className="advertisement-label">広告</span>
      <iframe
        className="advertisement-frame"
        title={`${position === "top" ? "上部" : "下部"}広告`}
        src={`/ad-frame/${position}`}
        width="300"
        height="250"
        scrolling="no"
        loading={position === "bottom" ? "lazy" : "eager"}
      />
    </aside>
  );
}
