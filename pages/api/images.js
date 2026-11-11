// pages/api/images.js — 차트 이미지 1장 = Redis 키 1개
// POST { dataUrl } → { id }   /   GET ?id= → 이미지 바이너리 (<img src>로 바로 사용)
import crypto from "crypto";
import { redis, IMG_PREFIX } from "../../lib/redis";
import { requireAuth } from "../../lib/auth";

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

const ID_RE = /^img_[a-z0-9_]+$/;
const DATA_RE = /^data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/=]+)$/;

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  try {
    if (req.method === "POST") {
      const dataUrl = req.body?.dataUrl;
      if (typeof dataUrl !== "string" || !DATA_RE.test(dataUrl)) return res.status(400).json({ error: "이미지 형식 오류" });
      if (dataUrl.length > 3.5 * 1024 * 1024) return res.status(413).json({ error: "이미지가 너무 큽니다" });
      const id = `img_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      await redis.set(IMG_PREFIX + id, dataUrl);
      return res.json({ id });
    }
    if (req.method === "GET") {
      const id = String(req.query.id || "");
      if (!ID_RE.test(id)) return res.status(400).end();
      const dataUrl = await redis.get(IMG_PREFIX + id);
      const m = DATA_RE.exec(dataUrl || "");
      if (!m) return res.status(404).end();
      // 이미지는 한 번 저장되면 바뀌지 않으므로 브라우저에 오래 캐시
      res.setHeader("Content-Type", m[1]);
      res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
      return res.send(Buffer.from(m[2], "base64"));
    }
    res.status(405).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
