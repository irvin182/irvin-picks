"use client";

import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L, { LatLngBoundsExpression } from "leaflet";
import { useEffect, useMemo } from "react";

type Risk = "LOW" | "MEDIUM" | "HIGH";

type LoginLog = {
  id: string;
  email: string | null;
  ip: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  country: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  isp?: string | null;
  asn?: string | null;
  is_vpn?: boolean | null;
  is_proxy?: boolean | null;
  is_tor?: boolean | null;
  risk?: Risk | null;
  created_at: string;
};

type SecurityMapProps = {
  logs: LoginLog[];
};

const riskConfig: Record<
  Risk,
  { label: string; color: string; bg: string; border: string }
> = {
  LOW: {
    label: "LOW",
    color: "#22c55e",
    bg: "rgba(34, 197, 94, 0.25)",
    border: "#22c55e",
  },
  MEDIUM: {
    label: "MEDIUM",
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.28)",
    border: "#f59e0b",
  },
  HIGH: {
    label: "HIGH",
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.30)",
    border: "#ef4444",
  },
};

function getRisk(log: LoginLog): Risk {
  if (log.risk === "LOW" || log.risk === "MEDIUM" || log.risk === "HIGH") {
    return log.risk;
  }

  if (log.is_tor || log.is_vpn || log.is_proxy) return "HIGH";

  return "LOW";
}

function createRiskIcon(risk: Risk) {
  const config = riskConfig[risk];

  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 22px;
        height: 22px;
        border-radius: 9999px;
        background: ${config.bg};
        border: 3px solid ${config.border};
        box-shadow: 0 0 18px ${config.color};
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 8px;
          height: 8px;
          border-radius: 9999px;
          background: ${config.color};
        "></div>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });
}

const riskIcons: Record<Risk, L.DivIcon> = {
  LOW: createRiskIcon("LOW"),
  MEDIUM: createRiskIcon("MEDIUM"),
  HIGH: createRiskIcon("HIGH"),
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fecha desconocida";
  }

  return date.toLocaleString("es-ES");
}

function boolLabel(value: boolean | null | undefined) {
  return value ? "Sí" : "No";
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    if (points.length === 1) {
      map.setView(points[0], 6);
      return;
    }

    const bounds: LatLngBoundsExpression = points;

    map.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 6,
    });
  }, [map, points]);

  return null;
}

export default function SecurityMap({ logs }: SecurityMapProps) {
  const validLogs = useMemo(() => {
    return logs.filter(
      (log) =>
        typeof log.latitude === "number" &&
        typeof log.longitude === "number" &&
        !Number.isNaN(log.latitude) &&
        !Number.isNaN(log.longitude)
    );
  }, [logs]);

  const points = useMemo<[number, number][]>(() => {
    return validLogs.map((log) => [
      Number(log.latitude),
      Number(log.longitude),
    ]);
  }, [validLogs]);

  if (validLogs.length === 0) {
    return (
      <div className="h-80 rounded-3xl border border-white/10 bg-[#02070d] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-3">🌍</div>
          <div className="text-xl font-black text-green-400">
            Sin coordenadas todavía
          </div>
          <div className="text-white/40 text-sm mt-2">
            Cuando existan latitude y longitude, aparecerán los marcadores.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-80 rounded-3xl border border-white/10 bg-[#02070d] overflow-hidden">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        scrollWheelZoom
        className="h-full w-full z-0"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds points={points} />

        {validLogs.map((log) => {
          const risk = getRisk(log);
          const riskInfo = riskConfig[risk];

          return (
            <Marker
              key={log.id}
              position={[Number(log.latitude), Number(log.longitude)]}
              icon={riskIcons[risk]}
            >
              <Popup>
                <div style={{ minWidth: 250, color: "#0f172a" }}>
                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: 15,
                      marginBottom: 10,
                    }}
                  >
                    Conexión detectada
                  </div>

                  <strong>Email</strong>
                  <div>{log.email ?? "Sin email"}</div>

                  <br />

                  <strong>IP</strong>
                  <div>{log.ip ?? "Sin IP"}</div>

                  <br />

                  <strong>Ubicación</strong>
                  <div>
                    {log.city ?? "Ciudad desconocida"},{" "}
                    {log.country ?? "País desconocido"}
                  </div>

                  <br />

                  <strong>ISP / ASN</strong>
                  <div>
                    {log.isp ?? "ISP desconocido"} ·{" "}
                    {log.asn ?? "ASN desconocido"}
                  </div>

                  <br />

                  <strong>Navegador / Sistema / Dispositivo</strong>
                  <div>
                    {log.browser ?? "Navegador desconocido"} ·{" "}
                    {log.os ?? "SO desconocido"} ·{" "}
                    {log.device ?? "Dispositivo desconocido"}
                  </div>

                  <br />

                  <strong>VPN / Proxy / Tor</strong>
                  <div>
                    VPN: {boolLabel(log.is_vpn)} · Proxy:{" "}
                    {boolLabel(log.is_proxy)} · Tor: {boolLabel(log.is_tor)}
                  </div>

                  <br />

                  <strong>Riesgo</strong>
                  <div
                    style={{
                      display: "inline-block",
                      marginTop: 4,
                      padding: "4px 9px",
                      borderRadius: 999,
                      background: riskInfo.bg,
                      border: `1px solid ${riskInfo.border}`,
                      color: riskInfo.color,
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    {riskInfo.label}
                  </div>

                  <br />
                  <br />

                  <strong>Hora</strong>
                  <div>{formatDate(log.created_at)}</div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}