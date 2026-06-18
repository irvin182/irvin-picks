import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const ADMIN_PATHS = ["/admin", "/api/admin"];

const PRIVATE_PATHS = [
  "/probador",
  "/api/live",
  "/api/fixture",
  "/api/model",
  "/api/odds",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAdminPath = ADMIN_PATHS.some((path) => pathname.startsWith(path));
  const isPrivatePath = PRIVATE_PATHS.some((path) => pathname.startsWith(path));

  if (isAdminPath) {
    const isAdmin =
      (token as any)?.role === "ADMIN" || (token as any)?.plan === "admin";

    if (!token || !isAdmin) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  if (isPrivatePath) {
    if (!token || (token as any)?.blocked === true) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/probador/:path*",
    "/api/live/:path*",
    "/api/fixture/:path*",
    "/api/model/:path*",
    "/api/odds/:path*",
  ],
};