import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { detectBrowser } from "@/lib/browserParser";
import { detectOS, detectDevice } from "@/lib/deviceParser";
import { getGeoData } from "@/lib/geoIp";

const DUPLICATE_WINDOW_MINUTES = 30;

type Risk = "LOW" | "MEDIUM" | "HIGH";

type GeoData = {
  country: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  isp: string | null;
  asn: string | null;
  is_vpn: boolean;
  is_proxy: boolean;
  is_tor: boolean;
  connection_type: string | null;
};

type PreviousLogin = {
  id: string;
  ip: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  country: string | null;
  city: string | null;
  created_at: string;
};

function hasValue(value: string | null | undefined) {
  const clean = String(value ?? "").trim();
  return clean.length > 0 && clean !== "Desconocida" && clean !== "Sin ubicación";
}

async function createSecurityEvent(payload: {
  userId: string;
  email: string;
  type: string;
  title: string;
  risk: Risk;
  ip: string;
  country: string | null;
  city: string | null;
  browser: string;
  os: string;
  device: string;
  reason: string;
  metadata?: Record<string, any>;
}) {
  const { error } = await supabaseAdmin.from("security_events").insert({
    user_id: payload.userId,
    email: payload.email,
    type: payload.type,
    title: payload.title,
    risk: payload.risk,
    ip: payload.ip,
    country: payload.country,
    city: payload.city,
    browser: payload.browser,
    os: payload.os,
    device: payload.device,
    reason: payload.reason,
    metadata: payload.metadata ?? null,
  });

  if (error) {
    console.error("❌ ERROR INSERTANDO SECURITY_EVENT:", error);
  }
}

async function createSmartSecurityEvents(params: {
  userId: string;
  email: string;
  ip: string;
  browser: string;
  os: string;
  device: string;
  geo: GeoData;
}) {
  const { userId, email, ip, browser, os, device, geo } = params;

  const { data: previousLogs, error } = await supabaseAdmin
    .from("login_logs")
    .select("id,ip,browser,os,device,country,city,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("❌ ERROR BUSCANDO HISTORIAL PARA EVENTOS:", error);
    return;
  }

  const history = (previousLogs ?? []) as PreviousLogin[];

  if (geo.is_tor || geo.is_vpn || geo.is_proxy) {
    await createSecurityEvent({
      userId,
      email,
      type: geo.is_tor ? "TOR_DETECTED" : geo.is_vpn ? "VPN_DETECTED" : "PROXY_DETECTED",
      title: geo.is_tor
        ? "Tor detectado"
        : geo.is_vpn
        ? "VPN detectada"
        : "Proxy detectado",
      risk: geo.is_tor ? "HIGH" : "MEDIUM",
      ip,
      country: geo.country,
      city: geo.city,
      browser,
      os,
      device,
      reason: "El usuario inició sesión desde una conexión anónima o intermediada.",
      metadata: {
        isp: geo.isp,
        asn: geo.asn,
        connection_type: geo.connection_type,
        is_vpn: geo.is_vpn,
        is_proxy: geo.is_proxy,
        is_tor: geo.is_tor,
      },
    });
  }

  if (history.length === 0) {
    await createSecurityEvent({
      userId,
      email,
      type: "FIRST_LOGIN",
      title: "Primer inicio de sesión registrado",
      risk: "LOW",
      ip,
      country: geo.country,
      city: geo.city,
      browser,
      os,
      device,
      reason: "Primer acceso registrado para este usuario.",
      metadata: {
        isp: geo.isp,
        asn: geo.asn,
        connection_type: geo.connection_type,
      },
    });

    return;
  }

  const previousIps = new Set(history.map((item) => item.ip).filter(hasValue));
  const previousCountries = new Set(history.map((item) => item.country).filter(hasValue));
  const previousCities = new Set(history.map((item) => item.city).filter(hasValue));
  const previousBrowsers = new Set(history.map((item) => item.browser).filter(hasValue));
  const previousDevices = new Set(history.map((item) => item.device).filter(hasValue));

  if (hasValue(ip) && previousIps.size > 0 && !previousIps.has(ip)) {
    await createSecurityEvent({
      userId,
      email,
      type: "NEW_IP",
      title: "Nueva IP detectada",
      risk: "MEDIUM",
      ip,
      country: geo.country,
      city: geo.city,
      browser,
      os,
      device,
      reason: "El usuario inició sesión desde una IP no vista anteriormente.",
      metadata: { previousIps: Array.from(previousIps).slice(0, 5) },
    });
  }

  if (hasValue(geo.country) && previousCountries.size > 0 && !previousCountries.has(geo.country)) {
    await createSecurityEvent({
      userId,
      email,
      type: "NEW_COUNTRY",
      title: "Nuevo país detectado",
      risk: "HIGH",
      ip,
      country: geo.country,
      city: geo.city,
      browser,
      os,
      device,
      reason: "El usuario inició sesión desde un país no visto anteriormente.",
      metadata: { previousCountries: Array.from(previousCountries) },
    });
  }

  if (hasValue(geo.city) && previousCities.size > 0 && !previousCities.has(geo.city)) {
    await createSecurityEvent({
      userId,
      email,
      type: "NEW_CITY",
      title: "Nueva ciudad detectada",
      risk: "MEDIUM",
      ip,
      country: geo.country,
      city: geo.city,
      browser,
      os,
      device,
      reason: "El usuario inició sesión desde una ciudad no vista anteriormente.",
      metadata: { previousCities: Array.from(previousCities).slice(0, 10) },
    });
  }

  if (hasValue(browser) && previousBrowsers.size > 0 && !previousBrowsers.has(browser)) {
    await createSecurityEvent({
      userId,
      email,
      type: "NEW_BROWSER",
      title: "Nuevo navegador detectado",
      risk: "MEDIUM",
      ip,
      country: geo.country,
      city: geo.city,
      browser,
      os,
      device,
      reason: "El usuario inició sesión desde un navegador no visto anteriormente.",
      metadata: { previousBrowsers: Array.from(previousBrowsers) },
    });
  }

  if (hasValue(device) && previousDevices.size > 0 && !previousDevices.has(device)) {
    await createSecurityEvent({
      userId,
      email,
      type: "NEW_DEVICE",
      title: "Nuevo dispositivo detectado",
      risk: "MEDIUM",
      ip,
      country: geo.country,
      city: geo.city,
      browser,
      os,
      device,
      reason: "El usuario inició sesión desde un dispositivo no visto anteriormente.",
      metadata: { previousDevices: Array.from(previousDevices) },
    });
  }
}

export async function saveLogin(
  req: Request,
  user: {
    id: string;
    email: string;
    role: string;
  }
) {
  try {
    const forwarded = req.headers.get("x-forwarded-for");

    const ip =
      forwarded?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "Desconocida";

    const userAgent = req.headers.get("user-agent") || "Desconocido";

    const browser = detectBrowser(userAgent);
    const os = detectOS(userAgent);
    const device = detectDevice(userAgent);

    const since = new Date(
      Date.now() - DUPLICATE_WINDOW_MINUTES * 60 * 1000
    ).toISOString();

    const { data: lastLog, error: lastLogError } = await supabaseAdmin
      .from("login_logs")
      .select("id,ip,browser,os,device,created_at")
      .eq("user_id", user.id)
      .eq("ip", ip)
      .eq("browser", browser)
      .eq("os", os)
      .eq("device", device)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastLogError) {
      console.error("❌ ERROR BUSCANDO LOGIN DUPLICADO:", lastLogError);
    }

    if (lastLog) return;

    const geo = await getGeoData(ip);

    await createSmartSecurityEvents({
      userId: user.id,
      email: user.email,
      ip,
      browser,
      os,
      device,
      geo,
    });

    const { error } = await supabaseAdmin.from("login_logs").insert({
      user_id: user.id,
      email: user.email,
      role: user.role,
      ip,
      user_agent: userAgent,
      browser,
      os,
      device,
      country: geo.country,
      city: geo.city,
      latitude: geo.latitude,
      longitude: geo.longitude,
      isp: geo.isp,
      asn: geo.asn,
      is_vpn: geo.is_vpn,
      is_proxy: geo.is_proxy,
      is_tor: geo.is_tor,
      connection_type: geo.connection_type,
    });

    if (error) {
      console.error("❌ ERROR INSERTANDO LOGIN:", error);
    }
  } catch (err) {
    console.error("❌ Error guardando login:", err);
  }
}