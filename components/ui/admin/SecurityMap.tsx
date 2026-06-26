"use client";

import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L, { LatLngBoundsExpression } from "leaflet";
import { useEffect, useMemo } from "react";

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
  created_at: string;
};

type SecurityMapProps = {
  logs: LoginLog[];
};

const greenIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-ES");
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

        {validLogs.map((log) => (
          <Marker
            key={log.id}
            position={[Number(log.latitude), Number(log.longitude)]}
            icon={greenIcon}
          >
            <Popup>
              <div style={{ minWidth: 220 }}>
                <strong>Usuario</strong>
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

                <strong>Hora de conexión</strong>
                <div>{formatDate(log.created_at)}</div>

                <br />

                <strong>Dispositivo</strong>
                <div>
                  {log.browser ?? "Navegador desconocido"} ·{" "}
                  {log.os ?? "SO desconocido"} ·{" "}
                  {log.device ?? "Dispositivo desconocido"}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}