import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { detectBrowser } from "@/lib/browserParser";
import { detectOS, detectDevice } from "@/lib/deviceParser";
import { getGeoData } from "@/lib/geoIp";

const DUPLICATE_WINDOW_MINUTES = 30;
const IMPOSSIBLE_TRAVEL_SPEED_KMH = 950;

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
  latitude: number | null;
  longitude: number | null;
  created_at: string;
};

function hasValue(value: string | null | undefined) {
  const clean = String(value ?? "").trim();
  return clean.length > 0 && clean !== "Desconocida" && clean !== "Sin ubicación";
}

function getHeader(req: any, name: string) {
  const headers = req?.headers;

  if (!headers) return null;

  if (typeof headers.get === "function") {
    return headers.get(name);
  }

  const direct = headers[name];
  const lower = headers[name.toLowerCase()];

  const value = direct ?? lower;

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
    .select("id,ip,browser,os,device,country,city,latitude,longitude,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("❌ ERROR BUSCANDO HISTORIAL PARA EVENTOS:", error);
    return;
  }

  const history = (previousLogs ?? []) as PreviousLogin[];

  const lastGeoLogin = history.find(
    (item) =>
      typeof item.latitude === "number" &&
      typeof item.longitude === "number"
  );

  if (
    lastGeoLogin &&
    geo.latitude !== null &&
    geo.longitude !== null &&
    lastGeoLogin.latitude !== null &&
    lastGeoLogin.longitude !== null
  ) {
    const currentTime = Date.now();
    const previousTime = new Date(lastGeoLogin.created_at).getTime();
    const diffHours = Math.max((currentTime - previousTime) / 3600000, 0.01);

    const km = distanceKm(
      lastGeoLogin.latitude,
      lastGeoLogin.longitude,
      geo.latitude,
      geo.longitude
    );

    const speedKmh = km / diffHours;

    if (km >= 500 && speedKmh > IMPOSSIBLE_TRAVEL_SPEED_KMH) {
      await createSecurityEvent({
        userId,
        email,
        type: "IMPOSSIBLE_TRAVEL",
        title: "Viaje imposible detectado",
        risk: "HIGH",
        ip,
        country: geo.country,
        city: geo.city,
        browser,
        os,
        device,
        reason:
          "El usuario inició sesión desde una ubicación muy lejana en un tiempo físicamente imposible.",
        metadata: {
          previousIp: lastGeoLogin.ip,
          previousCountry: lastGeoLogin.country,
          previousCity: lastGeoLogin.city,
          previousLatitude: lastGeoLogin.latitude,
          previousLongitude: lastGeoLogin.longitude,
          currentCountry: geo.country,
          currentCity: geo.city,
          currentLatitude: geo.latitude,
          currentLongitude: geo.longitude,
          distanceKm: Math.round(km),
          diffMinutes: Math.round(diffHours * 60),
          estimatedSpeedKmh: Math.round(speedKmh),
        },
      });
    }
  }

  if (geo.is_tor || geo.is_vpn || geo.is_proxy) {
    await createSecurityEvent({
      userId,
      email,
      type: geo.is_tor
        ? "TOR_DETECTED"
        : geo.is_vpn
        ? "VPN_DETECTED"
        : "PROXY_DETECTED",
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
      reason:
        "El usuario inició sesión desde una conexión anónima o intermediada.",
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
  const previousCountries = new Set(
    history.map((item) => item.country).filter(hasValue)
  );
  const previousCities = new Set(
    history.map((item) => item.city).filter(hasValue)
  );
  const previousBrowsers = new Set(
    history.map((item) => item.browser).filter(hasValue)
  );
  const previousDevices = new Set(
    history.map((item) => item.device).filter(hasValue)
  );

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

  if (
    hasValue(geo.country) &&
    previousCountries.size > 0 &&
    !previousCountries.has(geo.country)
  ) {
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

  if (
    hasValue(geo.city) &&
    previousCities.size > 0 &&
    !previousCities.has(geo.city)
  ) {
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

  if (
    hasValue(browser) &&
    previousBrowsers.size > 0 &&
    !previousBrowsers.has(browser)
  ) {
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
      reason:
        "El usuario inició sesión desde un navegador no visto anteriormente.",
      metadata: { previousBrowsers: Array.from(previousBrowsers) },
    });
  }

  if (
    hasValue(device) &&
    previousDevices.size > 0 &&
    !previousDevices.has(device)
  ) {
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
      reason:
        "El usuario inició sesión desde un dispositivo no visto anteriormente.",
      metadata: { previousDevices: Array.from(previousDevices) },
    });
  }
}

export async function saveLogin(
  req: any,
  user: {
    id: string;
    email: string;
    role: string;
  }
) {
  try {
    const forwarded = getHeader(req, "x-forwarded-for");

    const ip =
      forwarded?.split(",")[0]?.trim() ||
      getHeader(req, "x-real-ip") ||
      "Desconocida";

    const userAgent = getHeader(req, "user-agent") || "Desconocido";

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