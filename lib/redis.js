// lib/redis.js
import { Redis } from "@upstash/redis";

// UPSTASH_REDIS_REST_URL/TOKEN 또는 Vercel 연동 이름(KV_REST_API_URL/TOKEN) 모두 지원
// 붙여넣기 실수(앞뒤 공백·따옴표, 끝 슬래시) 정리
const clean = v => (v || "").trim().replace(/^["']|["']$/g, "").trim();
const url = clean(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL).replace(/\/+$/, "");
const token = clean(process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN);
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
// ok | missing_env | bad_url(https REST 주소 아님) | not_found(DB 없음·삭제됨) | bad_token | unreachable
export async function storageStatus() {
  if (!storageConfigured) return "missing_env";
  if (!/^https:\/\/[^\s/]+$/.test(url)) return "bad_url";
  try { await redis.ping(); return "ok"; }
  catch (e) {
    const msg = String(e?.message || "") + " " + String(e?.cause?.code || e?.cause?.message || "");
    console.error("[storage] ping:", msg);
    if (/unauthorized|WRONGPASS|401/i.test(msg)) return "bad_token";
    if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(msg)) return "not_found";
    return "unreachable";
  }
}
