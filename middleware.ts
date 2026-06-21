import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const ALLOWED_PLANS = ["beta", "premium", "vip", "admin"];

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const pathname = req.nextUrl.pathname;

  // Si no hay sesión, mandar al login
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = String((token as any).role ?? "").toUpperCase();
  const plan = String((token as any).plan ?? "").toLowerCase();

  // Admin puede entrar a todo
  if (role === "ADMIN") {
    return NextResponse.next();
  }

  // Usuarios normales NO pueden entrar al admin
  if (pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/probador", req.url));
  }

  // Proteger Live TV por plan
  if (pathname.startsWith("/probador/TV")) {
    if (!ALLOWED_PLANS.includes(plan)) {
      return NextResponse.redirect(new URL("/probador/upgrade", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/probador/:path*"],
};  