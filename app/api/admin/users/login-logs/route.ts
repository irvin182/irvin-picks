import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { supabase } from "@/lib/supabase";

async function isAdmin(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  return (token as any)?.role === "ADMIN" || (token as any)?.plan === "admin";
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("login_logs")
    .select("id,user_id,email,role,ip,user_agent,created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: "Error cargando logs" }, { status: 500 });
  }

  return NextResponse.json({ logs: data ?? [] });
}