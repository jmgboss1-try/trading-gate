// pages/api/data.js
import { Redis } from "@upstash/redis";
const redis = Redis.fromEnv();
const PREFIX = "tg:"; // tradegate prefix

export default async function handler(req, res) {
  const { key } = req.query;
  const fullKey = PREFIX + key;
  if (req.method === "GET") {
    try {
      const data = await redis.get(fullKey);
      res.json({ data });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } else if (req.method === "POST") {
    try {
      const { value } = req.body;
      await redis.set(fullKey, value);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } else {
    res.status(405).end();
  }
}
