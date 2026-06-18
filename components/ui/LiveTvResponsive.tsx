"use client";

import React, { useEffect, useState } from "react";
import LiveTvDashboard from "./LiveTvDashboard";
import LiveTvMobile from "./LiveTvMobile";

export default function LiveTvResponsive() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < 900);
    }

    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return isMobile ? <LiveTvMobile /> : <LiveTvDashboard />;
}