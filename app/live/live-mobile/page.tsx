"use client";

import dynamic from "next/dynamic";
import AuthGuard from "@/components/ui/AuthGuard";

const LiveTvMobile = dynamic(
  () => import("@/components/ui/LiveTvMobile"),
  { ssr: false }
);

export default function Page() {
  return (
    <AuthGuard>
      <LiveTvMobile />
    </AuthGuard>
  );
}