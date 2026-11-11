// pages/api/data.js
// 작은 설정성 데이터 전용 (포지션은 /api/positions, 이미지는 /api/images)
import { redis, PREFIX } from "../../lib/redis";
import { requireAuth } from "../../lib/auth";

const ALLOWED_KEYS = new Set(["seed", "checklist", "settings"]);

export default async function handler(req, res) {
  // 캐시 완전 방지
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  if (!requireAuth(req, res)) return;

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
