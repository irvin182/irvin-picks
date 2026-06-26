export async function getGeoData(ip: string) {
  try {
    if (!ip || ip === "Desconocida" || ip.startsWith("127.") || ip === "::1") {
      return {
        country: null,
        city: null,
        latitude: null,
        longitude: null,
      };
    }

    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        country: null,
        city: null,
        latitude: null,
        longitude: null,
      };
    }

    const data = await res.json();

    return {
      country: data?.country_name ?? null,
      city: data?.city ?? null,
      latitude: data?.latitude ?? null,
      longitude: data?.longitude ?? null,
    };
  } catch {
    return {
      country: null,
      city: null,
      latitude: null,
      longitude: null,
    };
  }
}