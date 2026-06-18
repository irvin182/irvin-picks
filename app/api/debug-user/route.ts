import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ error: "Falta email" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("app_users")
    .select("id,email,password,name,plan,active,expires_at")
    .eq("email", email)
    .maybeSingle();

  return NextResponse.json({
    searchedEmail: email,
    found: !!data,
    data,
    error,
  });
}