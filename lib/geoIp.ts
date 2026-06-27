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

const EMPTY_GEO: GeoData = {
  country: null,
  city: null,
  latitude: null,
  longitude: null,
  isp: null,
  asn: null,
  is_vpn: false,
  is_proxy: false,
  is_tor: false,
  connection_type: null,
};

function isPrivateOrInvalidIp(ip: string) {
  if (!ip) return true;
  if (ip === "Desconocida") return true;
  if (ip.startsWith("127.")) return true;
  if (ip === "::1") return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;

  return false;
}

function toNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

async function fetchWithTimeout(url: string, timeoutMs = 3500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function getFromIpWho(ip: string): Promise<GeoData | null> {
  const res = await fetchWithTimeout(`https://ipwho.is/${ip}`);

  if (!res.ok) return null;

  const data = await res.json();

  if (data?.success === false) return null;

  const latitude = toNumber(data?.latitude);
  const longitude = toNumber(data?.longitude);

  if (latitude === null || longitude === null) return null;

  const security = data?.security ?? {};
  const connection = data?.connection ?? {};

  return {
    country: data?.country ?? null,
    city: data?.city ?? null,
    latitude,
    longitude,
    isp: connection?.isp ?? null,
    asn: connection?.asn ? String(connection.asn) : null,
    is_vpn: Boolean(security?.vpn),
    is_proxy: Boolean(security?.proxy),
    is_tor: Boolean(security?.tor),
    connection_type: connection?.type ?? null,
  };
}

async function getFromIpApi(ip: string): Promise<GeoData | null> {
  const res = await fetchWithTimeout(`https://ipapi.co/${ip}/json/`);

  if (!res.ok) return null;

  const data = await res.json();

  const latitude = toNumber(data?.latitude);
  const longitude = toNumber(data?.longitude);

  if (latitude === null || longitude === null) return null;

  return {
    country: data?.country_name ?? null,
    city: data?.city ?? null,
    latitude,
    longitude,
    isp: data?.org ?? null,
    asn: data?.asn ?? null,
    is_vpn: false,
    is_proxy: false,
    is_tor: false,
    connection_type: null,
  };
}

export async function getGeoData(ip: string): Promise<GeoData> {
  try {
    if (isPrivateOrInvalidIp(ip)) {
      return EMPTY_GEO;
    }

    const primary = await getFromIpWho(ip);

    if (primary) {
      return primary;
    }

    const fallback = await getFromIpApi(ip);

    if (fallback) {
      return fallback;
    }

    return EMPTY_GEO;
  } catch {
    return EMPTY_GEO;
  }
}