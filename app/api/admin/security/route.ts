import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Risk = "LOW" | "MEDIUM" | "HIGH";

type LoginLog = {
  id: string;
  user_id: string | null;
  email: string | null;
  role: string | null;
  ip: string | null;
  user_agent: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  country: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  isp: string | null;
  asn: string | null;
  is_vpn: boolean | null;
  is_proxy: boolean | null;
  is_tor: boolean | null;
  connection_type: string | null;
  created_at: string;
};

type LoginAttempt = {
  id: string;
  email: string | null;
  ip: string | null;
  success: boolean;
  reason: string | null;
  created_at: string;
};

type SecurityEvent = {
  id: string;
  email: string | null;
  type: string;
  title: string;
  risk: Risk;
  ip: string | null;
  country: string | null;
  city: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  reason: string | null;
  created_at: string;
};

async function isAdmin(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  return String((token as any)?.role ?? "").toUpperCase() === "ADMIN";
}

function hasValue(value: string | null | undefined) {
  const clean = String(value ?? "").trim();
  return clean.length > 0 && clean !== "Sin ubicación" && clean !== "Sin IP";
}

function getAttemptRisk(attempt: LoginAttempt, failedByIp: Record<string, number>): Risk {
  if (attempt.success === false) {
    const count = attempt.ip ? failedByIp[attempt.ip] ?? 0 : 0;
    if (count >= 5) return "HIGH";
    return "MEDIUM";
  }

  return "LOW";
}

function getAttemptTitle(attempt: LoginAttempt, failedByIp: Record<string, number>) {
  if (attempt.success) return "Intento de login correcto";

  const count = attempt.ip ? failedByIp[attempt.ip] ?? 0 : 0;
  if (count >= 5) return "Múltiples intentos fallidos desde la misma IP";

  return "Intento de login fallido";
}

function normalizeRisk(value: string | null | undefined): Risk {
  const risk = String(value ?? "LOW").toUpperCase();
  if (risk === "HIGH") return "HIGH";
  if (risk === "MEDIUM") return "MEDIUM";
  return "LOW";
}

function getLogRisk(log: LoginLog): Risk {
  if (log.is_tor) return "HIGH";
  if (log.is_vpn || log.is_proxy) return "MEDIUM";
  if (!hasValue(log.country)) return "MEDIUM";
  return "LOW";
}

function calculateGlobalRisk(events: any[], suspiciousIps: any[]): Risk {
  const hasHigh = events.some((event) => event.risk === "HIGH");
  const hasMedium = events.some((event) => event.risk === "MEDIUM");

  if (hasHigh || suspiciousIps.some((ip) => ip.risk === "HIGH")) return "HIGH";
  if (hasMedium || suspiciousIps.length > 0) return "MEDIUM";

  return "LOW";
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: logs, error: logsError } = await supabaseAdmin
    .from("login_logs")
    .select(
      "id,user_id,email,role,ip,user_agent,browser,os,device,country,city,latitude,longitude,isp,asn,is_vpn,is_proxy,is_tor,connection_type,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(500);

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
    .limit(500);

  const { data: smartEvents, error: smartEventsError } = await supabaseAdmin
    .from("security_events")
    .select("id,email,type,title,risk,ip,country,city,browser,os,device,reason,created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (smartEventsError) {
    console.error("Error cargando security_events:", smartEventsError);
  }

  const safeLogs = (logs ?? []) as LoginLog[];
  const safeAttempts = attemptsError ? [] : ((attempts ?? []) as LoginAttempt[]);
  const safeSmartEvents = smartEventsError ? [] : ((smartEvents ?? []) as SecurityEvent[]);

  const failed = safeAttempts.filter((a) => a.success === false);
  const success = safeAttempts.filter((a) => a.success === true);

  const failedByIp = failed.reduce((acc: Record<string, number>, attempt) => {
    const ip = attempt.ip || "Sin IP";
    acc[ip] = (acc[ip] ?? 0) + 1;
    return acc;
  }, {});

  const suspiciousIps = Object.entries(failedByIp)
    .map(([ip, count]) => ({
      ip,
      count,
      risk: count >= 5 ? "HIGH" : count >= 2 ? "MEDIUM" : "LOW",
    }))
    .filter((item) => item.risk !== "LOW")
    .sort((a, b) => b.count - a.count);

  const countries = safeLogs.reduce((acc: Record<string, number>, log) => {
    const key = hasValue(log.country) ? String(log.country) : "Sin ubicación";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const loginEvents = safeLogs.map((log) => ({
    id: `log-${log.id}`,
    type: "LOGIN_SUCCESS",
    title: "Inicio de sesión correcto",
    email: log.email,
    role: log.role,
    ip: log.ip,
    browser: log.browser,
    os: log.os,
    device: log.device,
    country: log.country || "Sin ubicación",
    city: log.city,
    latitude: log.latitude,
    longitude: log.longitude,
    isp: log.isp,
    asn: log.asn,
    is_vpn: Boolean(log.is_vpn),
    is_proxy: Boolean(log.is_proxy),
    is_tor: Boolean(log.is_tor),
    connection_type: log.connection_type,
    risk: getLogRisk(log),
    created_at: log.created_at,
  }));

  const attemptEvents = safeAttempts.map((attempt) => {
    const risk = getAttemptRisk(attempt, failedByIp);

    return {
      id: `attempt-${attempt.id}`,
      type: attempt.success ? "LOGIN_ATTEMPT_SUCCESS" : "LOGIN_FAILED",
      title: getAttemptTitle(attempt, failedByIp),
      email: attempt.email,
      role: null,
      ip: attempt.ip,
      browser: null,
      os: null,
      device: null,
      country: "Sin ubicación",
      city: null,
      latitude: null,
      longitude: null,
      isp: null,
      asn: null,
      is_vpn: false,
      is_proxy: false,
      is_tor: false,
      connection_type: null,
      reason: attempt.reason,
      risk,
      created_at: attempt.created_at,
    };
  });

  const securityEvents = safeSmartEvents.map((event) => ({
    id: `security-${event.id}`,
    type: event.type,
    title: event.title,
    email: event.email,
    role: null,
    ip: event.ip,
    browser: event.browser,
    os: event.os,
    device: event.device,
    country: event.country || "Sin ubicación",
    city: event.city,
    latitude: null,
    longitude: null,
    isp: null,
    asn: null,
    is_vpn: event.type === "VPN_DETECTED",
    is_proxy: event.type === "PROXY_DETECTED",
    is_tor: event.type === "TOR_DETECTED",
    connection_type: null,
    reason: event.reason,
    risk: normalizeRisk(event.risk),
    created_at: event.created_at,
  }));

  const events = [...securityEvents, ...attemptEvents, ...loginEvents]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 150);

  const globalRisk = calculateGlobalRisk(events, suspiciousIps);

return NextResponse.json({
  summary: {
    risk: globalRisk,
    attempts: safeAttempts.length,
    success: success.length,
    failed: failed.length,
    suspiciousIps: suspiciousIps.length,
    events: events.length,
  },
  attempts: safeAttempts,
  logs: safeLogs.map((log) => ({
    ...log,
    is_vpn: Boolean(log.is_vpn),
    is_proxy: Boolean(log.is_proxy),
    is_tor: Boolean(log.is_tor),
    risk: getLogRisk(log),
  })),
  events,
  countries,
  suspiciousIps,
});
}