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

async function isAdmin(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  return String((token as any)?.role ?? "").toUpperCase() === "ADMIN";
}

function normalize(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function hasValue(value: string | null | undefined) {
  const clean = normalize(value);
  return clean.length > 0 && clean !== "Sin ubicación" && clean !== "Sin IP";
}

function maxRisk(a: Risk, b: Risk): Risk {
  const score = { LOW: 1, MEDIUM: 2, HIGH: 3 };
  return score[b] > score[a] ? b : a;
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

function buildSuspiciousEventsForLog(log: LoginLog, previousLogs: LoginLog[]) {
  const events: any[] = [];

  const previousIps = new Set(
    previousLogs.map((item) => item.ip).filter((ip) => hasValue(ip))
  );

  const previousCountries = new Set(
    previousLogs.map((item) => item.country).filter((country) => hasValue(country))
  );

  const previousCities = new Set(
    previousLogs.map((item) => item.city).filter((city) => hasValue(city))
  );

  const previousBrowsers = new Set(
    previousLogs.map((item) => item.browser).filter((browser) => hasValue(browser))
  );

  const previousDevices = new Set(
    previousLogs.map((item) => item.device).filter((device) => hasValue(device))
  );

  const base = {
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
    created_at: log.created_at,
  };

  if (hasValue(log.ip) && previousIps.size > 0 && !previousIps.has(log.ip)) {
    events.push({
      id: `new-ip-${log.id}`,
      type: "NEW_IP",
      title: "Nueva IP detectada",
      risk: "MEDIUM",
      reason: "El usuario inició sesión desde una IP no vista anteriormente.",
      ...base,
    });
  }

  if (
    hasValue(log.country) &&
    previousCountries.size > 0 &&
    !previousCountries.has(log.country)
  ) {
    events.push({
      id: `country-change-${log.id}`,
      type: "COUNTRY_CHANGE",
      title: "Cambio de país detectado",
      risk: "HIGH",
      reason: "El usuario inició sesión desde un país distinto al habitual.",
      ...base,
    });
  }

  if (hasValue(log.city) && previousCities.size > 0 && !previousCities.has(log.city)) {
    events.push({
      id: `city-change-${log.id}`,
      type: "CITY_CHANGE",
      title: "Nueva ciudad detectada",
      risk: "MEDIUM",
      reason: "El usuario inició sesión desde una ciudad distinta.",
      ...base,
    });
  }

  if (
    hasValue(log.browser) &&
    previousBrowsers.size > 0 &&
    !previousBrowsers.has(log.browser)
  ) {
    events.push({
      id: `browser-change-${log.id}`,
      type: "NEW_BROWSER",
      title: "Nuevo navegador detectado",
      risk: "MEDIUM",
      reason: "El usuario inició sesión desde un navegador no visto antes.",
      ...base,
    });
  }

  if (
    hasValue(log.device) &&
    previousDevices.size > 0 &&
    !previousDevices.has(log.device)
  ) {
    events.push({
      id: `device-change-${log.id}`,
      type: "NEW_DEVICE",
      title: "Nuevo dispositivo detectado",
      risk: "MEDIUM",
      reason: "El usuario inició sesión desde un dispositivo no visto antes.",
      ...base,
    });
  }

  return events;
}

function buildLoginEvent(log: LoginLog, suspiciousEvents: any[]) {
  let risk: Risk = "LOW";

  for (const event of suspiciousEvents) {
    risk = maxRisk(risk, event.risk);
  }

  if (!hasValue(log.country)) {
    risk = maxRisk(risk, "MEDIUM");
  }

  return {
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
    risk,
    created_at: log.created_at,
  };
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

  const safeLogs = (logs ?? []) as LoginLog[];
  const safeAttempts = attemptsError ? [] : ((attempts ?? []) as LoginAttempt[]);

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

  const logsByUser = safeLogs.reduce((acc: Record<string, LoginLog[]>, log) => {
    const key = log.user_id || log.email || "unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {});

  const allEvents: any[] = [];

  for (const log of safeLogs) {
    const key = log.user_id || log.email || "unknown";
    const userLogs = logsByUser[key] ?? [];

    const previousLogs = userLogs.filter(
      (item) => new Date(item.created_at).getTime() < new Date(log.created_at).getTime()
    );

    const suspiciousEvents = buildSuspiciousEventsForLog(log, previousLogs);
    const loginEvent = buildLoginEvent(log, suspiciousEvents);

    allEvents.push(loginEvent);
    allEvents.push(...suspiciousEvents);
  }

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
      reason: attempt.reason,
      risk,
      created_at: attempt.created_at,
    };
  });

  const events = [...allEvents, ...attemptEvents]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 150);

  const highEvents = events.filter((event) => event.risk === "HIGH").length;
  const mediumEvents = events.filter((event) => event.risk === "MEDIUM").length;

  let globalRisk: Risk = "LOW";

  if (highEvents > 0 || suspiciousIps.some((ip) => ip.risk === "HIGH")) {
    globalRisk = "HIGH";
  } else if (mediumEvents > 0 || suspiciousIps.length > 0) {
    globalRisk = "MEDIUM";
  }

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
    logs: safeLogs,
    events,
    countries,
    suspiciousIps,
  });
}