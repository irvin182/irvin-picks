import { Redis } from "@upstash/redis";

export function getApiFootballRedis(): Redis {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error("Redis no está configurado");
  }

  return new Redis({ url, token });
}
