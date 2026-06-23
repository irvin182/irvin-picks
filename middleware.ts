import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const ALLOWED_PLANS = ["beta", "premium", "vip"];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const isAdminPath = pathname.startsWith("/admin");

  const isPrivatePath =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/probador") ||
    pathname.startsWith("/live") ||
    pathname.startsWith("/reports");

  if (!isAdminPath && !isPrivatePath) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  const role = String((token as any).role ?? "").toUpperCase();
  const plan = String((token as any).plan ?? "").toLowerCase();
  const blocked = (token as any).blocked === true;
  const active = (token as any).active !== false;
  const expiresAt = (token as any).expires_at ?? null;

  if (blocked || !active) {
    return NextResponse.redirect(
      new URL("/login?error=account_disabled", req.url)
    );
  }

  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    return NextResponse.redirect(new URL("/pricing", req.url));
  }

  if (isAdminPath && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (role === "ADMIN") {
    return NextResponse.next();
  }

  if (isPrivatePath && !ALLOWED_PLANS.includes(plan)) {
    return NextResponse.redirect(new URL("/pricing", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/probador/:path*",
    "/live/:path*",
    "/reports/:path*",
  ],
};