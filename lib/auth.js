// lib/auth.js — 단일 사용자 비밀번호 로그인 (APP_PASSWORD)
import crypto from "crypto";

export const COOKIE = "tg_session";
const MAX_AGE = 60 * 60 * 24 * 180; // 180일 — 폰에서 매번 로그인하지 않도록

// 서명 키: AUTH_SECRET 우선, 없으면 비밀번호에서 파생 → 비밀번호를 바꾸면 기존 세션 모두 만료
const secret = () => process.env.AUTH_SECRET || process.env.APP_PASSWORD || "";
const sign = s => crypto.createHmac("sha256", secret()).update("tg-v1:" + s).digest("base64url");
const sha = s => crypto.createHash("sha256").update(String(s)).digest();

function safeEqual(a, b) {
  const A = Buffer.from(a), B = Buffer.from(b);
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

export const isConfigured = () => !!process.env.APP_PASSWORD;

export function checkPassword(input) {
  if (!isConfigured() || typeof input !== "string") return false;
  return crypto.timingSafeEqual(sha(input), sha(process.env.APP_PASSWORD));
}

export function makeToken() {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  return exp + "." + sign(exp);
}

export function verifyToken(token) {
  if (!token || !secret()) return false;
  const [exp, sig] = String(token).split(".");
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, sign(exp));
}

const cookieAttrs = maxAge =>
  `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}` + (process.env.NODE_ENV === "production" ? "; Secure" : "");

export const setSessionCookie = (res, token) => res.setHeader("Set-Cookie", `${COOKIE}=${token}; ${cookieAttrs(MAX_AGE)}`);
export const clearSessionCookie = res => res.setHeader("Set-Cookie", `${COOKIE}=; ${cookieAttrs(0)}`);

export const isAuthed = req => verifyToken(req.cookies?.[COOKIE]);

// API 핸들러 맨 앞에서 호출 — false면 이미 응답이 끝난 상태
export function requireAuth(req, res) {
  if (!isConfigured()) {
    res.status(503).json({ error: "서버에 APP_PASSWORD 환경변수를 설정하세요", code: "NO_PASSWORD" });
    return false;
  }
  if (!isAuthed(req)) {
    res.status(401).json({ error: "로그인이 필요합니다", code: "AUTH" });
    return false;
  }
  return true;
}
