export function detectOS(userAgent: string) {
  if (userAgent.includes("Windows")) return "Windows";
  if (userAgent.includes("Mac")) return "macOS";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("iPhone")) return "iPhone";
  if (userAgent.includes("iPad")) return "iPadOS";
  if (userAgent.includes("Linux")) return "Linux";

  return "Desconocido";
}

export function detectDevice(userAgent: string) {
  if (userAgent.includes("Mobile")) return "Móvil";
  if (userAgent.includes("Tablet")) return "Tablet";

  return "Ordenador";
}