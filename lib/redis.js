// lib/redis.js
import { Redis } from "@upstash/redis";

// UPSTASH_REDIS_REST_URL/TOKEN 또는 Vercel 연동 이름(KV_REST_API_URL/TOKEN) 모두 지원
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
export const storageConfigured = !!(url && token);

export const redis = new Redis({ url: url || "https://missing.invalid", token: token || "missing" });
export const PREFIX = "tg:"; // tradegate prefix
export const POS_HASH = PREFIX + "pos";   // field = 포지션 id, value = 포지션 JSON (이미지는 id만)
export const IMG_PREFIX = PREFIX + "img:"; // 이미지 1장 = 키 1개 (dataURL)

export const parseJSON = v => (typeof v === "string" ? JSON.parse(v) : v);

// 저장소 오류를 사람이 읽을 수 있는 메시지로 (로그에는 원문 기록)
export function storageError(e, where) {
  console.error(`[storage] ${where}:`, e?.message || e);
  if (!storageConfigured) return "저장소(Upstash) 환경변수가 이 배포에 없습니다 — UPSTASH_REDIS_REST_URL / TOKEN 확인";
  const msg = String(e?.message || e);
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|getaddrinfo/i.test(msg)) return "저장소(Upstash)에 연결할 수 없습니다 — URL 확인";
  if (/unauthorized|WRONGPASS|401/i.test(msg)) return "저장소(Upstash) 토큰이 틀렸습니다 — TOKEN 확인";
  return "저장소 오류: " + msg;
}

// 연결 상태 점검 (값은 노출하지 않음)
export async function storageStatus() {
  if (!storageConfigured) return "missing_env";
  try { await redis.ping(); return "ok"; }
  catch (e) { return /unauthorized|WRONGPASS|401/i.test(String(e?.message)) ? "bad_token" : "unreachable"; }
}
