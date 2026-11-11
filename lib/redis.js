// lib/redis.js
import { Redis } from "@upstash/redis";

export const redis = Redis.fromEnv();
export const PREFIX = "tg:"; // tradegate prefix
export const POS_HASH = PREFIX + "pos";   // field = 포지션 id, value = 포지션 JSON (이미지는 id만)
export const IMG_PREFIX = PREFIX + "img:"; // 이미지 1장 = 키 1개 (dataURL)

export const parseJSON = v => (typeof v === "string" ? JSON.parse(v) : v);
