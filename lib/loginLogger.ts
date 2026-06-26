import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { detectBrowser } from "@/lib/browserParser";
import { detectOS, detectDevice } from "@/lib/deviceParser";
import { getGeoData } from "@/lib/geoIp";

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

    const geo = await getGeoData(ip);

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
    });

    if (error) {
      console.error("❌ ERROR INSERTANDO LOGIN:", error);
    }
  } catch (err) {
    console.error("❌ Error guardando login:", err);
  }
}