"use client";

import dynamic from "next/dynamic";
import AuthGuard from "@/components/ui/AuthGuard";

const LiveTvDashboard = dynamic(
  () => import("@/components/ui/LiveTvDashboard"),
  { ssr: false }
);

export default function Page() {
  return (
    <AuthGuard>
      <LiveTvDashboard />
    </AuthGuard>
  );
}