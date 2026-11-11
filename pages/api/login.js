// pages/api/login.js — POST: 로그인 / DELETE: 로그아웃
import { redis, PREFIX } from "../../lib/redis";
import { checkPassword, isConfigured, makeToken, setSessionCookie, clearSessionCookie } from "../../lib/auth";

const MAX_FAILS = 10;      // 15분에 10번 틀리면 잠금
const WINDOW_SEC = 15 * 60;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "DELETE") { clearSessionCookie(res); return res.json({ ok: true }); }
  if (req.method !== "POST") return res.status(405).end();
  if (!isConfigured()) return res.status(503).json({ error: "서버에 APP_PASSWORD 환경변수를 설정하세요", code: "NO_PASSWORD" });

  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const failKey = PREFIX + "loginfail:" + ip;
  try {
    const fails = Number(await redis.get(failKey)) || 0;
    if (fails >= MAX_FAILS) return res.status(429).json({ error: "시도가 너무 많습니다. 15분 후 다시 시도하세요." });

    if (!checkPassword(req.body?.password)) {
      const n = await redis.incr(failKey);
      if (n === 1) await redis.expire(failKey, WINDOW_SEC);
      return res.status(401).json({ error: `비밀번호가 틀렸습니다 (${Math.max(0, MAX_FAILS - n)}회 남음)` });
    }
    await redis.del(failKey);
    setSessionCookie(res, makeToken());
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
