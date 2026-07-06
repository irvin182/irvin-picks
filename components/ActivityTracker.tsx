"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ActivityTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    const ignoredPaths = ["/login", "/", "/pricing", "/success", "/cancel"];

    if (ignoredPaths.includes(pathname)) return;

    fetch("/api/activity", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}