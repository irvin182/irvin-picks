import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function isAdmin(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  return String((token as any)?.role ?? "").toUpperCase() === "ADMIN";
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: logs, error: logsError } = await supabaseAdmin
    .from("login_logs")
    .select(
      "id,user_id,email,role,ip,user_agent,browser,os,device,country,city,latitude,longitude,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(300);

  if (logsError) {
    console.error("Error cargando login_logs:", logsError);
    return NextResponse.json(
      { error: "Error cargando seguridad" },
      { status: 500 }
    );
  }

  const { data: attempts, error: attemptsError } = await supabaseAdmin
    .from("login_attempts")
    .select("id,email,ip,success,reason,created_at")
    .gte("created_at", since24h)
    .order("created_at", { ascending: false })
    .limit(300);

  const safeAttempts = attemptsError ? [] : attempts ?? [];
  const safeLogs = logs ?? [];

  const failed = safeAttempts.filter((a: any) => a.success === false);
  const success = safeAttempts.filter((a: any) => a.success === true);

  const suspiciousIps = Array.from(
    new Set(failed.map((a: any) => a.ip).filter(Boolean))
  );

  const countries = safeLogs.reduce((acc: Record<string, number>, log: any) => {
    const key = log.country || "Sin ubicación";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    summary: {
      risk: failed.length > 5 || suspiciousIps.length > 3 ? "MEDIUM" : "LOW",
      attempts: safeAttempts.length,
      success: success.length,
      failed: failed.length,
      suspiciousIps: suspiciousIps.length,
    },
    attempts: safeAttempts,
    logs: safeLogs,
    countries,
  });
}