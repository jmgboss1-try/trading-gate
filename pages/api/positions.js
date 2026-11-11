// pages/api/positions.js — 포지션을 하나씩 저장 (전체 배열을 한 키에 몰아넣지 않음)
// GET → { positions }   PUT { position } → 저장/수정   DELETE ?id= → 삭제(이미지 포함)
import crypto from "crypto";
import { redis, PREFIX, POS_HASH, IMG_PREFIX, parseJSON } from "../../lib/redis";
import { requireAuth } from "../../lib/auth";

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

const LEGACY_KEY = PREFIX + "positions";
const LEGACY_BACKUP = PREFIX + "positions_legacy_backup";
const IMG_ID_RE = /^img_[a-z0-9_]+$/;

const imageIdsOf = p => [...(p.images || []), ...(p.exitImages || [])].filter(x => typeof x === "string" && IMG_ID_RE.test(x));

// 구버전(tg:positions 한 덩어리, 이미지 base64 내장) → 신버전으로 1회 이전
async function migrateLegacy() {
  const legacy = parseJSON(await redis.get(LEGACY_KEY));
  if (!Array.isArray(legacy) || legacy.length === 0) return null;
  const fields = {};
  for (const p of legacy) {
    const out = { ...p };
    delete out.checklist; // 신버전은 checkedItems 스냅샷 사용 — 구버전 상세보기용으로 아래에서 생성
    if (!out.checkedItems && p.checked) {
      const all = (p.checklist || []).flatMap(g => g.items || []);
      out.checkedItems = Object.entries(p.checked)
        .filter(([, v]) => v?.on || v === true)
        .map(([id, v]) => { const it = all.find(i => i.id === id); return it ? { id, label: it.label, score: it.score, comment: v?.comment || "" } : null; })
        .filter(Boolean);
    }
    for (const field of ["images", "exitImages"]) {
      if (!Array.isArray(p[field])) continue;
      const ids = [];
      for (const img of p[field]) {
        const dataUrl = typeof img === "string" ? img : img?.preview;
        if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) continue;
        const id = `img_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
        await redis.set(IMG_PREFIX + id, dataUrl);
        ids.push(id);
      }
      out[field] = ids;
    }
    fields[String(out.id)] = JSON.stringify(out);
  }
  await redis.hset(POS_HASH, fields);
  await redis.rename(LEGACY_KEY, LEGACY_BACKUP); // 원본은 백업으로 보존
  return Object.values(fields).map(parseJSON);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!requireAuth(req, res)) return;
  try {
    if (req.method === "GET") {
      const h = await redis.hgetall(POS_HASH);
      let positions = h && Object.keys(h).length ? Object.values(h).map(parseJSON) : await migrateLegacy();
      positions = (positions || []).sort((a, b) => (b.id || 0) - (a.id || 0));
      return res.json({ positions });
    }
    if (req.method === "PUT") {
      const p = req.body?.position;
      if (!p || typeof p !== "object" || !p.id) return res.status(400).json({ error: "position.id 필요" });
      for (const field of ["images", "exitImages"]) {
        if (p[field] && !(Array.isArray(p[field]) && p[field].every(x => typeof x === "string" && IMG_ID_RE.test(x))))
          return res.status(400).json({ error: "이미지는 먼저 업로드해야 합니다" });
      }
      await redis.hset(POS_HASH, { [String(p.id)]: JSON.stringify(p) });
      return res.json({ ok: true });
    }
    if (req.method === "DELETE") {
      const id = String(req.query.id || "");
      const existing = parseJSON(await redis.hget(POS_HASH, id));
      if (existing) {
        const imgKeys = imageIdsOf(existing).map(x => IMG_PREFIX + x);
        if (imgKeys.length) await redis.del(...imgKeys);
      }
      await redis.hdel(POS_HASH, id);
      return res.json({ ok: true });
    }
    res.status(405).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
