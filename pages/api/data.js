// pages/api/data.js
import { Redis } from "@upstash/redis";
const redis = Redis.fromEnv();
const PREFIX = "tg:"; // tradegate prefix
const ALLOWED_KEYS = new Set(["positions", "seed", "checklist", "settings"]);

// Vercel 함수 요청 한도(4.5MB) 안쪽으로 — 이미지는 클라이언트에서 압축
export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

export default async function handler(req, res) {
  // 캐시 완전 방지
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");

  const key = req.method === "POST" ? req.body?.key : req.query?.key;
  if (!ALLOWED_KEYS.has(key)) return res.status(400).json({ error: "잘못된 key" });
  const fullKey = PREFIX + key;

  try {
    if (req.method === "GET") {
      const data = await redis.get(fullKey);
      return res.json({ data });
    }
    if (req.method === "POST") {
      const { value } = req.body;
      if (value === undefined) return res.status(400).json({ error: "value 필요" });
      await redis.set(fullKey, value);
      return res.json({ ok: true });
    }
    res.status(405).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
