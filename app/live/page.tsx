"use client";

import dynamic from "next/dynamic";
import AuthGuard from "@/components/ui/AuthGuard";

const LiveTvResponsive = dynamic(
  () => import("@/components/ui/LiveTvResponsive"),
  { ssr: false }
);

export default function Page() {
  return (
    <AuthGuard>
      <LiveTvResponsive />
    </AuthGuard>
  );
}