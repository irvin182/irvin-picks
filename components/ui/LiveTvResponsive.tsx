"use client";

import React, { useEffect, useState } from "react";
import LiveTvDashboard from "./LiveTvDashboard";
import LiveTvMobile from "./LiveTvMobile";

type ViewMode = "mobile" | "desktop";

function isRealMobile() {
  if (typeof window === "undefined") return false;

  const width = window.innerWidth;
  const userAgent = navigator.userAgent.toLowerCase();

  const isPhone =
    /iphone|android.*mobile|windows phone|ipod/.test(userAgent);

  return width < 768 && isPhone;
}

export default function LiveTvResponsive() {
  const [viewMode, setViewMode] = useState<ViewMode>("desktop");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function check() {
      setViewMode(isRealMobile() ? "mobile" : "desktop");
      setReady(true);
    }

    check();

    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);

    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  if (!ready) {
    return (
      <main className="min-h-[100dvh] bg-[#03070b] text-white flex items-center justify-center">
        <div className="text-green-400 font-black text-xl">
          IRVIN ANALYTICS
        </div>
      </main>
    );
  }

  return viewMode === "mobile" ? <LiveTvMobile /> : <LiveTvDashboard />;
}